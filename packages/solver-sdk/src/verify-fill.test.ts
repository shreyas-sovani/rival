import { readFileSync } from "node:fs";
import { receiptMath } from "@rival/intent";
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import { describe, expect, it, vi } from "vitest";
import { verifyFill } from "./verify-fill.ts";

const deployment = JSON.parse(readFileSync(new URL("../../../deployments/sepolia.json", import.meta.url), "utf8")) as {
  settlement: string;
  pools: { A: { fee: number } };
};

const SETTLEMENT = getAddress(deployment.settlement);
const POOL_FEE = deployment.pools.A.fee;
const TX = `0x${"ef".repeat(32)}` as Hex;
const INTENT = `0x${"cd".repeat(32)}` as Hex;
const MAKER = "0x0000000000000000000000000000000000000001" as Address;
const SOLVER = "0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3" as Address;
const TOKEN_IN = "0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d" as Address;
const TOKEN_OUT = "0x571c992873D31310B11Bf6bF6B44f2748B4bce8C" as Address;

const filled = parseAbiItem(
  "event Filled(bytes32 indexed intentHash, address indexed maker, address indexed solver, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fairOut, uint256 fairOutAfterFee, int32 improvementBps, int32 curveBps, uint32 elapsed)",
);

const amountOut = 3_000_000_000n;
const fairOut = 2_900_000_000n;
const curveBps = 20;
const elapsed = 12;

function log(args: { fairOutAfterFee: bigint; improvementBps: number }) {
  const topics = encodeEventTopics({
    abi: [filled],
    eventName: "Filled",
    args: { intentHash: INTENT, maker: MAKER, solver: SOLVER },
  });
  const unnamed = filled.inputs.filter((input) => !("indexed" in input && input.indexed));
  const data = encodeAbiParameters(unnamed, [
    TOKEN_IN,
    TOKEN_OUT,
    10n ** 18n,
    amountOut,
    fairOut,
    args.fairOutAfterFee,
    args.improvementBps,
    curveBps,
    elapsed,
  ]);
  return { address: SETTLEMENT, topics, data };
}

function client(entry: ReturnType<typeof log>) {
  return {
    getTransactionReceipt: vi.fn(async () => ({ status: "success", logs: [entry] })),
    readContract: vi.fn(async (args: { functionName: string }) => {
      if (args.functionName === "poolFee") return POOL_FEE;
      throw new Error(args.functionName);
    }),
  };
}

describe("verifyFill", () => {
  it("recomputes improvement with receiptMath and matches the Filled log", async () => {
    const math = receiptMath({ amountOut, fairOut, poolFee: POOL_FEE, curveBps, elapsed });
    const result = await verifyFill(TX, {
      client: client(log({ fairOutAfterFee: math.fairOutAfterFee, improvementBps: math.improvementBps })),
    });
    expect(result).toMatchObject({
      txHash: TX,
      intentHash: INTENT,
      maker: MAKER,
      solver: SOLVER,
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: (10n ** 18n).toString(),
      amountOut: amountOut.toString(),
      fairOut: fairOut.toString(),
      fairOutAfterFee: math.fairOutAfterFee.toString(),
      improvementBps: math.improvementBps,
      curveBps,
      elapsed,
      matchesReceipt: true,
    });
  });

  it("reports the recomputed improvement when the log disagrees", async () => {
    const math = receiptMath({ amountOut, fairOut, poolFee: POOL_FEE, curveBps, elapsed });
    const result = await verifyFill(TX, {
      client: client(log({ fairOutAfterFee: 1n, improvementBps: 1 })),
    });
    expect(result.improvementBps).toBe(math.improvementBps);
    expect(result.fairOutAfterFee).toBe(math.fairOutAfterFee.toString());
    expect(result.matchesReceipt).toBe(false);
  });
});
