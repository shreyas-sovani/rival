import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { createLiveSolverPorts, quoteAtSqrt, type PoolRef } from "./live.ts";
import type { Address, Hex } from "./types.ts";

const HOOK = "0xb17a547082836fDF87001c1DE031fA8A2D391080" as Address;
const TOKEN_IN = "0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d" as Address;
const TOKEN_OUT = "0x571c992873D31310B11Bf6bF6B44f2748B4bce8C" as Address;
const POOL_A = "0xd302ad11d027e1897d14162ac1d7a583a7c48a12a547a25c12c9bb1da504f13f" as Hex;
const POOL_B = "0xc990bf9d3e98afd98afafdad812369a1b8dd6822622f49cf9f7a312701c0549b" as Hex;
const STATE = "0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C" as Address;

const pool = (poolId: Hex): PoolRef => ({
  poolId,
  currency0: TOKEN_IN,
  currency1: TOKEN_OUT,
  fee: poolId === POOL_A ? 500 : 3000,
  tickSpacing: poolId === POOL_A ? 10 : 60,
  hooks: poolId === POOL_A ? HOOK : "0x0000000000000000000000000000000000000000",
});

describe("quoteAtSqrt", () => {
  it("returns the input when the sqrt price is 2^96", () => {
    expect(quoteAtSqrt(1n << 96n, 1_000n, true)).toBe(1_000n);
    expect(quoteAtSqrt(1n << 96n, 1_000n, false)).toBe(1_000n);
  });
});

describe("createLiveSolverPorts", () => {
  it("quotes the hook for the hooked venue and StateView for the other", async () => {
    const readContract = vi.fn(async (args: { functionName: string; address: Address }) => {
      if (args.functionName === "quote") return 42n;
      if (args.functionName === "getSlot0") return [1n << 96n, 0, 0, 3000];
      throw new Error(args.functionName);
    });
    const ports = createLiveSolverPorts({
      publicClient: { readContract } as never,
      walletClient: {} as never,
      account: privateKeyToAccount(generatePrivateKey()),
      chainId: 11155111,
      settlement: "0xdD66D017e4B4FfF51aBEf2f559C68065D4FD9850",
      permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      uniswapSolver: "0xDBe8a61e1A4cDd767FfA7C822C242B8E85414e17",
      hook: HOOK,
      poolA: pool(POOL_A),
      poolB: pool(POOL_B),
      book: { listOpen: async () => [] },
      presence: { lastExtend: async () => 0n, extend: async () => undefined },
      strategy: "sprint",
    });

    await expect(
      ports.quoter.quoteExactInput({
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amountIn: 10n ** 15n,
        venue: "hooked",
      }),
    ).resolves.toBe(42n);
    await expect(
      ports.quoter.quoteExactInput({
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amountIn: 1_000n,
        venue: "other",
      }),
    ).resolves.toBe(1_000n);

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: HOOK, functionName: "quote" }));
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: STATE, functionName: "getSlot0" }));
  });
});
