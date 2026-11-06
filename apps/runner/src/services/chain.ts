import { loadDeployments } from "@rival/chain";
import { createRpcPool, FILL_ABI } from "@rival/solver-sdk";
import {
  createPublicClient,
  decodeErrorResult,
  getAddress,
  parseAbi,
  parseAbiItem,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { sepolia } from "viem/chains";
import { MAX_ORACLE_AGE_SEC } from "../handlers/health.ts";
import { FillSimulationFailed } from "../handlers/types.ts";
import type { Intent } from "@rival/intent";

/** Canonical Permit2. It is not a Rival deployment, so it is not in sepolia.json. */
export const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");

const ERROR_ABI = parseAbi([
  "error NotStarted()",
  "error Expired()",
  "error Cancelled()",
  "error AlreadyFilled()",
  "error BadSignature()",
  "error BadParams()",
  "error OracleUnavailable()",
  "error BelowFloor()",
  "error SelfFill()",
  "error NotListed()",
  "error NotAllowlisted()",
  "error GateFailed()",
  "error DeliveryShort()",
  "error Unauthorized()",
  "error InvalidSigner()",
  "error InvalidSignature()",
  "error InvalidNonce()",
  "error SignatureExpired(uint256 deadline)",
]);

const READ_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function nonceBitmap(address owner, uint256 wordPos) view returns (uint256)",
  "function oldestTimestamp(bytes32 id) view returns (uint32)",
  "function ringState(bytes32 id) view returns (uint16 index, uint16 cardinality)",
  "function observation(bytes32 id, uint16 slot) view returns (uint32 ts, int56 tickCumulative, int24 blockStartTick)",
  "function consult((address,address,uint24,int24,address) key, uint32 window) view returns (int24)",
  "function quote((address,address,uint24,int24,address) key, bool zeroForOne, uint128 amountIn, uint32 window) view returns (uint256)",
  "function status(bytes32 intentHash) view returns (uint8)",
]);

const FILLED_EVENT = parseAbiItem(
  "event Filled(bytes32 indexed intentHash, address indexed maker, address indexed solver, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fairOut, uint256 fairOutAfterFee, int32 improvementBps, int32 curveBps, uint32 elapsed)",
);

const SIMULATE_ABI = [...FILL_ABI, ...ERROR_ABI];

export interface PoolRef {
  poolId: Hex;
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface ChainConfig {
  chainId: 11155111;
  permit2: Address;
  settlement: Address;
  faucet: Address;
  publisher: Address;
  hook: Address;
  registry: Address;
  uniswapSolver: Address;
  tokens: { weth: Address; usdc: Address };
  poolA: PoolRef;
  poolB: PoolRef;
}

function poolOf(pool: {
  poolId: string;
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
}, hooks: Address): PoolRef {
  return {
    poolId: pool.poolId as Hex,
    currency0: getAddress(pool.currency0),
    currency1: getAddress(pool.currency1),
    fee: pool.fee,
    tickSpacing: pool.tickSpacing,
    hooks,
  };
}

let cachedConfig: ChainConfig | undefined;

/** Addresses from `deployments/sepolia.json`. Permit2 is the canonical contract. */
export function chainConfig(): ChainConfig {
  if (cachedConfig) return cachedConfig;
  const deployment = loadDeployments();
  const weth = getAddress(deployment.tokens.tWETH);
  const usdc = getAddress(deployment.tokens.tUSDC);
  const hook = getAddress(deployment.hook.address);
  const settlement = getAddress(deployment.settlement);
  const solver = deployment.uniswapSolvers[0];
  if (!solver) throw new Error("deployment is missing the Uniswap solver");
  cachedConfig = {
    chainId: deployment.chainId,
    permit2: PERMIT2,
    settlement,
    faucet: weth,
    publisher: settlement,
    hook,
    registry: getAddress(deployment.registry),
    uniswapSolver: getAddress(solver),
    tokens: { weth, usdc },
    poolA: poolOf(deployment.pools.A, hook),
    poolB: { ...poolOf(deployment.pools.B, "0x0000000000000000000000000000000000000000"), hooks: getAddress("0x0000000000000000000000000000000000000000") },
  };
  return cachedConfig;
}

export function rpcUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const names = ["SEPOLIA_RPC_URL", "SEPOLIA_RPC_URL_2", "SEPOLIA_RPC_URL_3"] as const;
  const urls: string[] = [];
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.trim() !== "") urls.push(value.trim());
  }
  return urls;
}

let cachedClient: { key: string; client: PublicClient } | undefined;

export function publicClient(): PublicClient | undefined {
  const urls = rpcUrls();
  if (urls.length === 0) return undefined;
  const key = urls.join("\n");
  if (cachedClient?.key === key) return cachedClient.client;
  const client = createPublicClient({
    chain: sepolia,
    transport: createRpcPool(urls, { timeoutMs: 8_000, cooldownMs: 2_000 }),
  });
  cachedClient = { key, client };
  return client;
}

export function nonceBitUsed(bitmap: bigint, nonce: bigint): boolean {
  return ((bitmap >> (nonce & 255n)) & 1n) === 1n;
}

export function safeReason(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as {
      shortMessage?: string;
      details?: string;
      reason?: string;
      message?: string;
      name?: string;
      data?: unknown;
      cause?: unknown;
    };
    if (record.shortMessage) parts.push(record.shortMessage);
    if (record.details) parts.push(record.details);
    if (record.reason) parts.push(record.reason);
    if (typeof record.data === "string") {
      const decoded = decodeRevertData(record.data);
      if (decoded) parts.push(decoded);
    }
    if (parts.length === 0 && record.name && record.name !== "Error") parts.push(record.name);
    if (parts.length === 0 && record.message) parts.push(record.message);
    current = record.cause;
  }
  if (parts.length === 0) parts.push("call reverted");
  return parts
    .join(" | ")
    .replace(/https?:\/\/\S+/g, "[rpc]")
    .replace(/0x[a-fA-F0-9]{64,}/g, "[redacted]")
    .slice(0, 240);
}

function decodeRevertData(data: string): string | undefined {
  if (!/^0x[0-9a-fA-F]{8,}$/.test(data)) return undefined;
  try {
    const decoded = decodeErrorResult({ abi: ERROR_ABI, data: data as Hex });
    return decoded.errorName;
  } catch {
    return undefined;
  }
}

/** Signature-stage reverts mean pricing succeeded. The handler does not pass `makerSig` into this call. */
export function fillReachedSignature(error: unknown): boolean {
  return /InvalidSigner|InvalidSignature|BadSignature/.test(safeReason(error));
}

function poolKey(pool: PoolRef) {
  return [pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks] as const;
}

export async function readNonceUsed(maker: Address, nonce: bigint): Promise<boolean> {
  const client = publicClient();
  if (!client) throw new Error("nonce unread");
  const bitmap = await client.readContract({
    address: chainConfig().permit2,
    abi: READ_ABI,
    functionName: "nonceBitmap",
    args: [maker, nonce >> 8n],
  });
  return nonceBitUsed(bitmap, nonce);
}

export async function readBalance(owner: Address, token: Address): Promise<bigint> {
  const client = publicClient();
  if (!client) throw new Error("balance unread");
  return client.readContract({
    address: token,
    abi: READ_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
}

export async function readOracleQuote(intent: Intent): Promise<bigint | null> {
  const client = publicClient();
  if (!client) return null;
  const chain = chainConfig();
  if (intent.oracleWindow < 60 || intent.oracleWindow > 3_600) return null;
  if (intent.amountIn <= 0n || intent.amountIn > (1n << 128n) - 1n) return null;
  const tokenIn = getAddress(intent.tokenIn);
  const zeroForOne = tokenIn === chain.poolA.currency0;
  const other = tokenIn === chain.poolA.currency1;
  if (!zeroForOne && !other) return null;
  try {
    const quoted = await client.readContract({
      address: chain.hook,
      abi: READ_ABI,
      functionName: "quote",
      args: [poolKey(chain.poolA), zeroForOne, intent.amountIn, intent.oracleWindow],
    });
    return quoted > 0n ? quoted : null;
  } catch {
    return null;
  }
}

const DUMMY_SIGNATURE = `0x${"11".repeat(65)}` as Hex;

export async function simulateHouseFill(intent: Intent): Promise<boolean> {
  const client = publicClient();
  const chain = chainConfig();
  if (!client) throw new FillSimulationFailed("settlement simulation unavailable");
  try {
    await client.simulateContract({
      address: chain.settlement,
      abi: SIMULATE_ABI,
      functionName: "fill",
      args: [intent, DUMMY_SIGNATURE, { inputTo: chain.uniswapSolver, useCallback: true, data: "0x", allowLabels: [] }],
      account: chain.uniswapSolver,
    });
    return true;
  } catch (error) {
    if (fillReachedSignature(error)) return true;
    throw new FillSimulationFailed(safeReason(error));
  }
}

export interface OracleReading {
  ageSec: number;
  obs: number;
}

const STALE: OracleReading = { ageSec: MAX_ORACLE_AGE_SEC + 1, obs: 0 };

export async function readOraclePool(pool: PoolRef): Promise<OracleReading> {
  const client = publicClient();
  if (!client) return STALE;
  try {
    const oldest = await client.readContract({
      address: chainConfig().hook,
      abi: READ_ABI,
      functionName: "oldestTimestamp",
      args: [pool.poolId],
    });
    if (Number(oldest) === 0) return STALE;
    const ring = await client.readContract({
      address: chainConfig().hook,
      abi: READ_ABI,
      functionName: "ringState",
      args: [pool.poolId],
    });
    const index = Number(ring[0]);
    const obs = Number(ring[1]);
    if (!Number.isInteger(obs) || obs <= 0) return STALE;
    const observation = await client.readContract({
      address: chainConfig().hook,
      abi: READ_ABI,
      functionName: "observation",
      args: [pool.poolId, index],
    });
    const ts = Number(observation[0]);
    if (!Number.isInteger(ts) || ts <= 0) return { ageSec: MAX_ORACLE_AGE_SEC + 1, obs };
    await client.readContract({
      address: chainConfig().hook,
      abi: READ_ABI,
      functionName: "consult",
      args: [poolKey(pool), 60],
    });
    const ageSec = Math.max(0, Math.floor(Date.now() / 1000) - ts);
    return { ageSec, obs };
  } catch {
    return STALE;
  }
}

export async function readIntentStatus(intentHash: Hex): Promise<"open" | "filled" | "cancelled" | "unknown"> {
  const client = publicClient();
  if (!client) return "unknown";
  try {
    const status = Number(
      await client.readContract({
        address: chainConfig().settlement,
        abi: READ_ABI,
        functionName: "status",
        args: [intentHash],
      }),
    );
    if (status === 1) return "filled";
    if (status === 2) return "cancelled";
    if (status === 0) return "open";
    return "unknown";
  } catch {
    return "unknown";
  }
}

const FILL_LOOKBACK = 20_000n;

export async function readLastFillAt(): Promise<number | null> {
  const client = publicClient();
  if (!client) return null;
  try {
    const head = await client.getBlockNumber();
    const fromBlock = head > FILL_LOOKBACK ? head - FILL_LOOKBACK : 0n;
    const logs = await client.getLogs({
      address: chainConfig().settlement,
      event: FILLED_EVENT,
      fromBlock,
      toBlock: head,
    });
    const latest = logs[logs.length - 1];
    if (!latest) return null;
    const block = await client.getBlock({ blockNumber: latest.blockNumber });
    const ts = Number(block.timestamp);
    return Number.isInteger(ts) && ts > 0 ? ts : null;
  } catch {
    return null;
  }
}

export async function readEth(owner: Address): Promise<bigint | undefined> {
  const client = publicClient();
  if (!client) return undefined;
  try {
    return await client.getBalance({ address: owner });
  } catch {
    return undefined;
  }
}
