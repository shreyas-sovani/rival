import type { PublishIntentInput } from "@rival/arkiv";
import { publishIntent } from "@rival/arkiv";
import { verifyCancelSignature, type Address as IntentAddress, type Intent, type IntentDomain } from "@rival/intent";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, parseAbi, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { createRpcPool } from "@rival/solver-sdk";
import { MAX_BLOCK_LAG_SEC, MAX_ORACLE_AGE_SEC } from "../handlers/health.ts";
import type {
  BotHealth,
  Bytes32,
  CancelRequest,
  FaucetRequest,
  HealthResponse,
  OraclePoolHealth,
} from "../handlers/types.ts";
import { arkivWriter, readArkivLatency, readOpenIntentCount } from "./arkiv.ts";
import { botSnapshot } from "./bots-state.ts";
import {
  chainConfig,
  publicClient,
  readBalance,
  readEth,
  readLastFillAt,
  readNonceUsed,
  readOraclePool,
  readOracleQuote,
  rpcUrls,
  simulateHouseFill,
} from "./chain.ts";

/**
 * Every process boundary the handlers can touch.
 * Health probes never throw: a missing Sepolia RPC or Arkiv client is a degraded field.
 * `probes.block` reads `SEPOLIA_RPC_URL` and reports that head when the call succeeds.
 */
export interface ArkivWriter {
  createEntity: (
    schema: unknown,
    values: unknown,
    options?: unknown,
  ) => Promise<{ entityKey: Bytes32 }>;
}

/** `(client, input) => entityKey`, the same call shape as `@rival/arkiv` `publishIntent`. */
export type IntentPublisher = (client: ArkivWriter, input: PublishIntentInput) => Promise<Bytes32>;

export interface RunnerDeps {
  clock: () => number;
  /** Source address for the faucet IP cap. Routes set this per request. */
  clientIp: () => string;
  chain: {
    chainId: number;
    permit2: IntentAddress;
    settlement: IntentAddress;
    domain: IntentDomain;
    faucet: IntentAddress;
    publisher: IntentAddress;
    tokens: { weth: IntentAddress; usdc: IntentAddress };
  };
  limits: {
    maxIntentsPerMaker: number;
    intentWindowSec: number;
    maxTokenClaimsPerIp: number;
  };
  nonceUsed: (maker: IntentAddress, nonce: bigint) => Promise<boolean>;
  balanceOf: (maker: IntentAddress, token: IntentAddress) => Promise<bigint>;
  /** PEGGED output quote. `null` means the oracle has nothing usable. */
  oracleQuote: (intent: Intent) => Promise<bigint | null>;
  /** House-solver `eth_call`. `false` rejects the intent. */
  simulateFill: (intent: Intent) => Promise<boolean>;
  arkiv: ArkivWriter;
  publish: IntentPublisher;
  mint: (req: FaucetRequest) => Promise<Bytes32>;
  ethRemaining: () => Promise<number>;
  verifyCancel: (req: CancelRequest) => Promise<boolean>;
  relayCancel: (req: CancelRequest) => Promise<Bytes32>;
  probes: {
    block: () => Promise<HealthResponse["block"]>;
    oracle: () => Promise<{ A: OraclePoolHealth; B?: OraclePoolHealth }>;
    bots: () => Promise<Record<string, BotHealth>>;
    house: () => Promise<HealthResponse["house"]>;
    arkiv: () => Promise<HealthResponse["arkiv"]>;
    openIntents: () => Promise<number>;
    lastFillAt: () => Promise<number | null>;
  };
}

const DEGRADED_BLOCK: HealthResponse["block"] = { number: "0", lagSec: MAX_BLOCK_LAG_SEC + 1 };
const DEGRADED_ORACLE = { A: { ageSec: MAX_ORACLE_AGE_SEC + 1, obs: 0 } };
const DEGRADED_HOUSE = { eth: "0", tWETH: "0", tUSDC: "0" };
const TOKEN_WETH = 5n * 10n ** 18n;
const TOKEN_USDC = 10_000n * 1_000_000n;
const ETH_DRIP = 10n ** 16n;
const MINT_ABI = parseAbi(["function mint(address to, uint256 amount)"]);
const CANCEL_ABI = parseAbi(["function cancelBySig(bytes32 intentHash, uint256 deadline, bytes sig)"]);

function sepoliaRpcUrl(): string | undefined {
  const value = process.env.SEPOLIA_RPC_URL;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function hexQuantity(value: unknown): bigint | undefined {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function blockFromRpc(payload: unknown): HealthResponse["block"] | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const result = (payload as { result?: unknown }).result;
  if (!result || typeof result !== "object") return undefined;
  const number = hexQuantity((result as { number?: unknown }).number);
  const timestamp = hexQuantity((result as { timestamp?: unknown }).timestamp);
  if (number === undefined || timestamp === undefined) return undefined;
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  const lagSec = Math.max(0, Math.floor(Date.now() / 1000) - Number(timestamp));
  return { number: number.toString(), lagSec };
}

/** Latest Sepolia head, or a lagging block when the RPC is missing or the call fails. */
async function readSepoliaBlock(): Promise<HealthResponse["block"]> {
  const rpc = sepoliaRpcUrl();
  if (!rpc) return DEGRADED_BLOCK;
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBlockByNumber",
        params: ["latest", false],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return DEGRADED_BLOCK;
    return blockFromRpc(await response.json()) ?? DEGRADED_BLOCK;
  } catch {
    return DEGRADED_BLOCK;
  }
}

function privateKey(name: string): Hex | undefined {
  const value = process.env[name]?.trim();
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) return undefined;
  return value as Hex;
}

function publisherAddress(): IntentAddress {
  const key = privateKey("RELAYER_PRIVATE_KEY") ?? privateKey("HOUSE_PRIVATE_KEY");
  if (!key) return chainConfig().settlement;
  return privateKeyToAccount(key).address;
}

function walletFor(key: Hex) {
  const urls = rpcUrls();
  if (urls.length === 0) throw new Error("rpc unavailable");
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: createRpcPool(urls, { timeoutMs: 8_000, cooldownMs: 2_000 }),
  });
  const client = publicClient();
  if (!client) throw new Error("rpc unavailable");
  return { account, wallet, client };
}

async function mint(req: FaucetRequest): Promise<Bytes32> {
  const key = privateKey("FAUCET_MINTER_PRIVATE_KEY");
  if (!key) throw new Error("faucet minter is not configured");
  const { account, wallet, client } = walletFor(key);
  if (req.kind === "eth") {
    const hash = await wallet.sendTransaction({ account, chain: sepolia, to: req.wallet, value: ETH_DRIP });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error("eth drip reverted");
    return hash;
  }
  const chain = chainConfig();
  let last: Hex | undefined;
  for (const [token, amount] of [
    [chain.tokens.weth, TOKEN_WETH],
    [chain.tokens.usdc, TOKEN_USDC],
  ] as const) {
    const hash = await wallet.writeContract({
      address: token,
      abi: MINT_ABI,
      functionName: "mint",
      args: [req.wallet, amount],
      account,
      chain: sepolia,
    });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error("token mint reverted");
    last = hash;
  }
  if (!last) throw new Error("token mint reverted");
  return last;
}

async function ethRemaining(): Promise<number> {
  const key = privateKey("FAUCET_MINTER_PRIVATE_KEY") ?? privateKey("RELAYER_PRIVATE_KEY");
  if (!key) return 0;
  const balance = await readEth(privateKeyToAccount(key).address);
  if (balance === undefined) return 0;
  return Number(balance / ETH_DRIP);
}

async function relayCancel(req: CancelRequest): Promise<Bytes32> {
  const key = privateKey("RELAYER_PRIVATE_KEY");
  if (!key) throw new Error("relayer is not configured");
  const { account, wallet, client } = walletFor(key);
  const hash = await wallet.writeContract({
    address: chainConfig().settlement,
    abi: CANCEL_ABI,
    functionName: "cancelBySig",
    args: [req.intentHash, BigInt(req.deadline), req.signature],
    account,
    chain: sepolia,
  });
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status !== "success") throw new Error("cancel reverted");
  return hash;
}

async function houseBalances(): Promise<HealthResponse["house"]> {
  const key = privateKey("HOUSE_PRIVATE_KEY");
  if (!key || !publicClient()) return DEGRADED_HOUSE;
  const owner = privateKeyToAccount(key).address;
  const chain = chainConfig();
  try {
    const [eth, weth, usdc] = await Promise.all([
      readEth(owner),
      readBalance(owner, chain.tokens.weth),
      readBalance(owner, chain.tokens.usdc),
    ]);
    if (eth === undefined) return DEGRADED_HOUSE;
    return { eth: eth.toString(), tWETH: weth.toString(), tUSDC: usdc.toString() };
  } catch {
    return DEGRADED_HOUSE;
  }
}

async function oracleProbe(): Promise<{ A: OraclePoolHealth; B?: OraclePoolHealth }> {
  const chain = chainConfig();
  try {
    const A = await readOraclePool(chain.poolA);
    const B = await readOraclePool(chain.poolB);
    if (B.obs === 0) return { A };
    return { A, B };
  } catch {
    return DEGRADED_ORACLE;
  }
}

const chain = chainConfig();

export const defaultRunnerDeps = {
  clock: () => Math.floor(Date.now() / 1000),
  clientIp: () => "unconfigured",
  chain: {
    chainId: chain.chainId,
    permit2: chain.permit2,
    settlement: chain.settlement,
    domain: {
      name: "RivalSettlement",
      version: "1",
      chainId: chain.chainId,
      verifyingContract: chain.settlement,
    },
    faucet: chain.faucet,
    publisher: publisherAddress(),
    tokens: chain.tokens,
  },
  limits: {
    maxIntentsPerMaker: 5,
    intentWindowSec: 60,
    maxTokenClaimsPerIp: 3,
  },
  nonceUsed: (maker, nonce) => readNonceUsed(maker, nonce),
  balanceOf: (maker, token) => readBalance(maker, token),
  oracleQuote: (intent) => readOracleQuote(intent),
  simulateFill: (intent) => simulateHouseFill(intent),
  arkiv: {
    createEntity: async (schema, values, options) => {
      const writer = arkivWriter();
      if (!writer) throw new Error("arkiv writer is not configured");
      return writer.createEntity(schema, values, options);
    },
  },
  publish: (client, input) => publishIntent(client as Parameters<typeof publishIntent>[0], input),
  mint,
  ethRemaining,
  verifyCancel: (req) =>
    verifyCancelSignature({
      intentHash: req.intentHash,
      deadline: BigInt(req.deadline),
      signature: req.signature,
      chainId: chain.chainId,
      verifyingContract: chain.settlement,
    }),
  relayCancel,
  probes: {
    block: readSepoliaBlock,
    oracle: oracleProbe,
    bots: async () => botSnapshot(),
    house: houseBalances,
    arkiv: () => readArkivLatency(),
    openIntents: async () => {
      try {
        return await readOpenIntentCount();
      } catch {
        return 0;
      }
    },
    lastFillAt: () => readLastFillAt(),
  },
} satisfies RunnerDeps;
