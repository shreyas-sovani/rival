import {
  encodeAbiParameters,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { encodeFill } from "./fill.ts";
import type { ArkivOpenBook, VenueQuoter } from "./ports.ts";
import { runSolver, type PresencePort, type RunSolverPorts, type RunSolverResult, type StrategyId } from "./run.ts";

/** Sepolia StateView from the Uniswap v4 deployment used by the venue. */
export const STATE_VIEW = "0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C" as Address;

const QUOTE_WINDOW = 60;
const UINT128_MAX = (1n << 128n) - 1n;

const READ_ABI = [
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "zeroForOne", type: "bool" },
      { name: "amountIn", type: "uint128" },
      { name: "window", type: "uint32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "nonceBitmap",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "wordPos", type: "uint256" },
    ],
    outputs: [{ name: "bitmap", type: "uint256" }],
  },
] as const;

export interface PoolRef {
  poolId: Hex;
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface LiveSolverInput {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: PrivateKeyAccount;
  chainId: number;
  settlement: Address;
  permit2: Address;
  uniswapSolver: Address;
  hook: Address;
  stateView?: Address;
  poolA: PoolRef;
  poolB: PoolRef;
  book: ArkivOpenBook;
  presence: PresencePort;
  strategy: StrategyId;
  othersPassing?: boolean;
  clock?: { now(): bigint };
}

function sellingCurrency0(pool: PoolRef, tokenIn: Address): boolean {
  return getAddress(tokenIn) === getAddress(pool.currency0);
}

/** Exact-input quote from a v4 sqrt price. Price 1 (`2^96`) returns `amountIn`. */
export function quoteAtSqrt(sqrtPriceX96: bigint, amountIn: bigint, zeroForOne: boolean): bigint {
  if (amountIn < 0n || amountIn > UINT128_MAX || sqrtPriceX96 <= 0n) {
    throw new Error("bad quote");
  }
  if (sqrtPriceX96 <= UINT128_MAX) {
    const ratioX192 = sqrtPriceX96 * sqrtPriceX96;
    const denom = 1n << 192n;
    return zeroForOne ? (ratioX192 * amountIn) / denom : (denom * amountIn) / ratioX192;
  }
  const ratioX128 = (sqrtPriceX96 * sqrtPriceX96) / (1n << 64n);
  const q128 = 1n << 128n;
  return zeroForOne ? (ratioX128 * amountIn) / q128 : (q128 * amountIn) / ratioX128;
}

function asBigint(value: unknown, label: string): bigint {
  if (typeof value === "bigint") return value;
  throw new Error(`${label} missing`);
}

function callbackData(pool: PoolRef): Hex {
  return encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    [
      {
        currency0: pool.currency0,
        currency1: pool.currency1,
        fee: pool.fee,
        tickSpacing: pool.tickSpacing,
        hooks: pool.hooks,
      },
    ],
  );
}

/**
 * Concrete ports for one solver loop. The book and presence writes stay injected so Arkiv
 * stays out of this package. Hook `quote` is the hooked venue. StateView `getSlot0` is the other.
 */
export function createLiveSolverPorts(input: LiveSolverInput): RunSolverPorts {
  const stateView = input.stateView ?? STATE_VIEW;
  const quoter: VenueQuoter = {
    quoteExactInput: async (args) => {
      const pool = args.venue === "hooked" ? input.poolA : input.poolB;
      const direction = sellingCurrency0(pool, args.tokenIn);
      if (args.venue === "hooked") {
        const quoted = await input.publicClient.readContract({
          address: input.hook,
          abi: READ_ABI,
          functionName: "quote",
          args: [
            {
              currency0: pool.currency0,
              currency1: pool.currency1,
              fee: pool.fee,
              tickSpacing: pool.tickSpacing,
              hooks: pool.hooks,
            },
            direction,
            args.amountIn,
            QUOTE_WINDOW,
          ],
        });
        return asBigint(quoted, "hook quote");
      }
      const slot0 = await input.publicClient.readContract({
        address: stateView,
        abi: READ_ABI,
        functionName: "getSlot0",
        args: [pool.poolId],
      });
      const sqrt = Array.isArray(slot0) ? slot0[0] : undefined;
      return quoteAtSqrt(asBigint(sqrt, "slot0"), args.amountIn, direction);
    },
  };

  const data = callbackData(input.poolA);
  return {
    book: input.book,
    quoter,
    submitter: {
      balanceOf: async (maker, token) => {
        const balance = await input.publicClient.readContract({
          address: token,
          abi: READ_ABI,
          functionName: "balanceOf",
          args: [maker],
        });
        return asBigint(balance, "balance");
      },
      nonceUsed: async (maker, nonce) => {
        const bitmap = await input.publicClient.readContract({
          address: input.permit2,
          abi: READ_ABI,
          functionName: "nonceBitmap",
          args: [maker, nonce >> 8n],
        });
        return ((asBigint(bitmap, "nonce bitmap") >> (nonce & 255n)) & 1n) === 1n;
      },
      submit: async (plan) => {
        const encoded = encodeFill(plan.intent, plan.signature, {
          inputTo: input.account.address,
          useCallback: true,
          data,
          allowLabels: [],
        });
        const nonce = await input.publicClient.getTransactionCount({
          address: input.account.address,
          blockTag: "pending",
        });
        const authorization = await input.account.signAuthorization({
          contractAddress: input.uniswapSolver,
          chainId: input.chainId,
          nonce: nonce + 1,
        });
        const hash = await input.walletClient.sendTransaction({
          account: input.account,
          chain: null,
          to: input.settlement,
          data: encoded.calldata,
          nonce,
          authorizationList: [authorization],
        });
        const receipt = await input.publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
        if (receipt.status !== "success") throw new Error("fill transaction reverted");
      },
    },
    clock: input.clock ?? { now: () => BigInt(Math.floor(Date.now() / 1000)) },
    presence: input.presence,
    strategy: input.strategy,
    chainId: input.chainId,
    settlement: input.settlement,
    permit2: input.permit2,
    othersPassing: input.othersPassing,
  };
}

/** One shared loop. Calls `runSolver` immediately, then on `intervalMs`. */
export function runSolverLoop(
  ports: RunSolverPorts,
  options: {
    intervalMs: number;
    onTick?: (result: RunSolverResult) => void;
    onError?: (error: unknown) => void;
  },
): { stop: () => void } {
  let stopped = false;
  const tick = (): void => {
    if (stopped) return;
    void runSolver(ports).then(
      (result) => {
        if (!stopped) options.onTick?.(result);
      },
      (error: unknown) => {
        if (!stopped) options.onError?.(error);
      },
    );
  };
  const timer = setInterval(tick, options.intervalMs);
  timer.unref?.();
  tick();
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
