import { createArkivClients, PAIR, upsertPresence, verifyPayload } from "@rival/arkiv";
import { buildIntent, permit2TypedData, type Address, type Hex, type Intent } from "@rival/intent";
import { createLiveSolverPorts, createRpcPool, runSolverLoop, type LiveSolverInput, type PoolRef } from "@rival/solver-sdk";
import { createWalletClient, encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { logger } from "../logger.ts";
import { arkivReadKeys, readOpenIntents } from "../services/arkiv.ts";
import { noteBot } from "../services/bots-state.ts";
import {
  chainConfig,
  publicClient,
  readBalance,
  readEth,
  rpcUrls,
  safeReason,
} from "../services/chain.ts";
import { defaultRunnerDeps } from "../services/deps.ts";
import { MakerRateLimit } from "../services/limits.ts";
import { entityPayload, pageEntities } from "../services/book-rows.ts";

const SWAP_HELPER = "0x9b6b46e2c869aa39918db7f52f5557fe577b6eee" as Address;
const MIN_SQRT = 4295128739n;
const MAX_SQRT = 1461446703485210103287273052203988822378723970342n;
const SWAP_IN = 10n ** 15n;
const USDC_IN = 1_000_000n;
const ETH_FLOOR = 15n * 10n ** 16n;
const SOLVER_INTERVAL_MS = 8_000;

const SWAP_ABI = parseAbi([
  "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, (bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) payable returns (int256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

function privateKey(name: string): Hex | undefined {
  const value = process.env[name]?.trim();
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) return undefined;
  return value as Hex;
}

function solverKey(label: string): Hex | undefined {
  const raw = process.env.SOLVER_KEYS_JSON;
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const value = (parsed as Record<string, unknown>)[label];
    if (typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)) return value as Hex;
  } catch {
    return undefined;
  }
  return undefined;
}

function makerKeys(): Hex[] {
  const raw = process.env.MAKERBOT_KEYS_JSON;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is Hex => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value))
      .slice(0, 2);
  } catch {
    return [];
  }
}

function skip(bot: string, reason: string): void {
  logger.warn({ bot, reason }, "bot skipped");
  noteBot(bot, false);
}

function every(minMs: number, maxMs: number, tick: () => Promise<void>): { stop: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (): void => {
    if (stopped) return;
    const delay = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
    timer = setTimeout(() => {
      void tick().finally(() => schedule());
    }, delay);
    timer.unref?.();
  };
  schedule();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

function wallet(key: Hex) {
  const account = privateKeyToAccount(key);
  return {
    account,
    client: createWalletClient({
      account,
      chain: sepolia,
      transport: createRpcPool(rpcUrls(), { timeoutMs: 8_000, cooldownMs: 2_000 }),
    }),
  };
}

let sellWeth = true;

async function marketMakerTick(key: Hex, stop: () => void): Promise<void> {
  const client = publicClient();
  if (!client) {
    skip("mm", "rpc unavailable");
    return;
  }
  const { account, client: signer } = wallet(key);
  const eth = await readEth(account.address);
  if (eth === undefined) {
    skip("mm", "eth balance unread");
    return;
  }
  if (eth < ETH_FLOOR) {
    skip("mm", "mm eth below 0.15");
    stop();
    return;
  }
  const chain = chainConfig();
  const direction = sellWeth;
  sellWeth = !sellWeth;
  const token = direction ? chain.tokens.weth : chain.tokens.usdc;
  const amount = direction ? SWAP_IN : USDC_IN;
  const balance = await readBalance(account.address, token);
  if (balance < amount) {
    skip("mm", "swap balance short");
    return;
  }
  const allowance = await client.readContract({
    address: token,
    abi: SWAP_ABI,
    functionName: "allowance",
    args: [account.address, SWAP_HELPER],
  });
  if (allowance < amount) {
    const approved = await signer.writeContract({
      address: token,
      abi: SWAP_ABI,
      functionName: "approve",
      args: [SWAP_HELPER, 2n ** 256n - 1n],
      account,
      chain: sepolia,
    });
    const approval = await client.waitForTransactionReceipt({ hash: approved, timeout: 60_000 });
    if (approval.status !== "success") {
      skip("mm", "swap approval reverted");
      return;
    }
  }
  const data = encodeFunctionData({
    abi: SWAP_ABI,
    functionName: "swap",
    args: [
      {
        currency0: chain.poolA.currency0,
        currency1: chain.poolA.currency1,
        fee: chain.poolA.fee,
        tickSpacing: chain.poolA.tickSpacing,
        hooks: chain.poolA.hooks,
      },
      {
        zeroForOne: direction,
        amountSpecified: -amount,
        sqrtPriceLimitX96: direction ? MIN_SQRT + 1n : MAX_SQRT - 1n,
      },
      { takeClaims: false, settleUsingBurn: false },
      "0x",
    ],
  });
  const hash = await signer.sendTransaction({ account, chain: sepolia, to: SWAP_HELPER, data });
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status !== "success") {
    skip("mm", "swap reverted");
    return;
  }
  noteBot("mm", true);
  logger.info({ bot: "mm", hash }, "keep-alive swap");
}

function openBook() {
  const chain = chainConfig();
  return {
    listOpen: async (now: bigint) => {
      const page = await readOpenIntents(PAIR, "open", Number(now));
      const rows: { intentJson: string; signature: Hex }[] = [];
      for (const entity of pageEntities(page)) {
        const payload = entityPayload(entity);
        if (!payload) continue;
        try {
          const verified = await verifyPayload(payload, {
            domain: defaultRunnerDeps.chain.domain,
            permit2: chain.permit2,
            settlement: chain.settlement,
            chainId: chain.chainId,
          });
          rows.push({
            intentJson: JSON.stringify({
              ...verified.intent,
              amountIn: verified.intent.amountIn.toString(),
              baseOut: verified.intent.baseOut.toString(),
              hardMinOut: verified.intent.hardMinOut.toString(),
              nonce: verified.intent.nonce.toString(),
            }),
            signature: verified.signature,
          });
        } catch {
          continue;
        }
      }
      return rows;
    },
  };
}

function presenceFor(account: Address, label: string, key: Hex) {
  let entityKey: Hex | undefined;
  let last = 0n;
  return {
    lastExtend: async () => last,
    extend: async (now: bigint) => {
      const readKeys = arkivReadKeys();
      const writeKey = process.env.ARKIV_ACCESS_KEY_WRITE?.trim();
      if (readKeys.length === 0 || !writeKey) throw new Error("arkiv writer is not configured");
      const client = createArkivClients({
        readKeys,
        writeKey,
        transport: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(8_000) }),
      }).wallet(privateKeyToAccount(key));
      entityKey = await upsertPresence(client, {
        solver: account,
        ensName: `${label}.solvers.rival.eth`,
        pair: PAIR,
        maxAmountIn: 10n ** 18n,
        strategy: label === "house" ? "house" : "sprint",
        version: "0.0.0",
        ...(entityKey ? { entityKey } : {}),
      });
      last = now;
    },
  };
}

function startSolver(label: string, key: Hex, strategy: "sprint" | "house", othersPassing?: boolean): void {
  const client = publicClient();
  if (!client) {
    skip(label, "rpc unavailable");
    return;
  }
  if (arkivReadKeys().length === 0) {
    skip(label, "arkiv reader is not configured");
    return;
  }
  const chain = chainConfig();
  const { account, client: signer } = wallet(key);
  const input: LiveSolverInput = {
    publicClient: client,
    walletClient: signer,
    account,
    chainId: chain.chainId,
    settlement: chain.settlement,
    permit2: chain.permit2,
    uniswapSolver: chain.uniswapSolver,
    hook: chain.hook,
    poolA: chain.poolA satisfies PoolRef,
    poolB: chain.poolB satisfies PoolRef,
    book: openBook(),
    presence: presenceFor(account.address, label, key),
    strategy,
    othersPassing,
  };
  runSolverLoop(createLiveSolverPorts(input), {
    intervalMs: SOLVER_INTERVAL_MS,
    onTick: (result) => {
      noteBot(label, true);
      logger.info(
        { bot: label, submitted: Boolean(result.submitted), presence: result.presenceExtended },
        "solver tick",
      );
    },
    onError: (error) => skip(label, safeReason(error)),
  });
}

const makerFailures = new Map<string, number>();

async function makerTick(key: Hex, limit: MakerRateLimit, stop: () => void): Promise<void> {
  const account = privateKeyToAccount(key);
  const label = `maker:${account.address.slice(0, 8)}`;
  const chain = chainConfig();
  if (!publicClient()) {
    skip(label, "rpc unavailable");
    return;
  }
  let balance: bigint;
  try {
    balance = await readBalance(account.address, chain.tokens.weth);
  } catch (error) {
    skip(label, safeReason(error));
    return;
  }
  if (balance < SWAP_IN) {
    skip(label, "maker balance short");
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  let nonce = BigInt(Date.now());
  try {
    if (await defaultRunnerDeps.nonceUsed(account.address, nonce)) nonce += 1n;
  } catch (error) {
    skip(label, safeReason(error));
    return;
  }
  const intent: Intent = buildIntent({
    maker: account.address,
    tokenIn: chain.tokens.weth,
    tokenOut: chain.tokens.usdc,
    amountIn: SWAP_IN,
    mode: 0,
    baseOut: 1n,
    hardMinOut: 1n,
    oracleWindow: 0,
    startTime: now,
    nonce,
    gate: 0,
  });
  try {
    limit.take(account.address);
  } catch (error) {
    skip(label, safeReason(error));
    return;
  }
  try {
    const typed = permit2TypedData({
      intent,
      permit2: chain.permit2,
      settlement: chain.settlement,
      chainId: chain.chainId,
    });
    const signature = await account.signTypedData({
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
    });
    const entityKey = await defaultRunnerDeps.publish(defaultRunnerDeps.arkiv, {
      intent,
      signature,
      publisher: defaultRunnerDeps.chain.publisher,
      domain: defaultRunnerDeps.chain.domain,
      permit2: chain.permit2,
      settlement: chain.settlement,
      chainId: chain.chainId,
      pair: PAIR,
    });
    makerFailures.set(account.address, 0);
    noteBot(label, true);
    logger.info({ bot: label, entityKey }, "maker intent posted");
  } catch (error) {
    const count = (makerFailures.get(account.address) ?? 0) + 1;
    makerFailures.set(account.address, count);
    skip(label, safeReason(error));
    if (count >= 3) {
      logger.warn({ bot: label }, "maker stopped after 3 submit failures");
      stop();
    }
  }
}

/** Boot the keep-alive, atlas, house, and two maker bots. A bot that cannot act logs and skips. */
export function startLiveServices(): void {
  const mm = privateKey("MM_PRIVATE_KEY");
  if (!mm) skip("mm", "mm key missing");
  else {
    const loop = every(45_000, 60_000, () =>
      marketMakerTick(mm, () => loop.stop()).catch((error: unknown) => skip("mm", safeReason(error))),
    );
  }

  const atlas = solverKey("atlas");
  if (!atlas) skip("atlas", "atlas key missing");
  else startSolver("atlas", atlas, "sprint");

  const house = privateKey("HOUSE_PRIVATE_KEY");
  if (!house) skip("house", "house key missing");
  else startSolver("house", house, "house", false);

  const makers = makerKeys();
  if (makers.length < 2) {
    skip("maker", "two maker keys required");
    return;
  }
  const limit = new MakerRateLimit(
    defaultRunnerDeps.limits.maxIntentsPerMaker,
    defaultRunnerDeps.limits.intentWindowSec,
    defaultRunnerDeps.clock,
  );
  for (const key of makers) {
    const loop = every(3 * 60_000, 5 * 60_000, () =>
      makerTick(key, limit, () => loop.stop()).catch((error: unknown) => skip("maker", safeReason(error))),
    );
  }
}
