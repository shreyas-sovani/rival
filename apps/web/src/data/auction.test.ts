import { receiptMath } from "@rival/intent";
import { describe, expect, it } from "vitest";
import { auctionStatusCopy, curveForIntent, receiptFromFill, type FillLog } from "./auction.ts";

const NO_SIGNED_INTENT = "This browser has no signed intent for this hash. Sign on the Trade page.";

const HASH = `0x${"cd".repeat(32)}` as const;
const SOLVER = "0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3" as const;
const MAKER = "0x0000000000000000000000000000000000000001" as const;
const TWETH = "0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d" as const;
const TUSDC = "0x571c992873D31310B11Bf6bF6B44f2748B4bce8C" as const;

const fill: FillLog = {
  intentHash: HASH,
  maker: MAKER,
  solver: SOLVER,
  tokenIn: TWETH,
  tokenOut: TUSDC,
  amountIn: 10n ** 18n,
  amountOut: 3_000_000_000n,
  fairOut: 2_900_000_000n,
  curveBps: 20,
  elapsed: 12,
  txHash: `0x${"ef".repeat(32)}`,
  blockNumber: 1n,
};

describe("auction status without a local signed intent", () => {
  it("tells this browser to sign on the Trade page", () => {
    const status = auctionStatusCopy({
      hashValid: true,
      hasStoredIntent: false,
      phase: "waiting",
      curveEmpty: true,
    });
    expect(status.phaseLabel).toBe(NO_SIGNED_INTENT);
    expect(status.banner).toBe(NO_SIGNED_INTENT);
    expect(`${status.phaseLabel} ${status.banner ?? ""}`).not.toMatch(/Waiting for chain events|still being read|racing/i);
  });

  it("keeps a distinct message when the intent hash is missing", () => {
    const status = auctionStatusCopy({
      hashValid: false,
      hasStoredIntent: false,
      phase: "waiting",
      curveEmpty: true,
    });
    expect(status.phaseLabel).toBe("Open this page with an intent hash.");
    expect(status.banner).toBeUndefined();
  });

  it("keeps a filled receipt status without saying a solver is still racing", () => {
    const status = auctionStatusCopy({
      hashValid: true,
      hasStoredIntent: false,
      phase: "filled",
      curveEmpty: true,
    });
    expect(status.phaseLabel).toBe("Filled");
    expect(status.banner).toBe(NO_SIGNED_INTENT);
    expect(`${status.phaseLabel} ${status.banner ?? ""}`).not.toMatch(/Waiting for chain events|still being read|racing/i);
  });
});

describe("auction receipt", () => {
  it("recomputes improvement with receiptMath and uses a resolved solver name", () => {
    const math = receiptMath({
      amountOut: fill.amountOut,
      fairOut: fill.fairOut,
      poolFee: 500,
      curveBps: fill.curveBps,
      elapsed: fill.elapsed,
    });
    const receipt = receiptFromFill({
      fill,
      poolDirectAtSign: "Pool A direct swap at signing time: unavailable",
    });
    expect(receipt.solverName).toBe("");
    expect(
      receiptFromFill({
        fill,
        poolDirectAtSign: "Pool A direct swap at signing time: unavailable",
        solverName: "atlas.solvers.rival.eth",
      }).solverName,
    ).toBe("atlas.solvers.rival.eth");
    expect(receipt.improvementBps).toBe(String(math.improvementBps));
    expect(receipt.curveBps).toBe("20");
    expect(receipt.amountOut).toBe("3000");
    expect(receipt.tx.href).toBe(`https://sepolia.etherscan.io/tx/${fill.txHash}`);
    expect(receipt.poolDirectAtSign).toContain("unavailable");
  });

  it("builds the decay series with requiredAt", () => {
    const curve = curveForIntent({
      intent: {
        mode: 0,
        baseOut: 3_000_000_000n,
        startBps: 20,
        floorBps: -30,
        startTime: 1_000,
        decaySecs: 90,
        hardMinOut: 2_955_000_000n,
      },
      quoteOut: 0n,
      poolOut: 3_000_000_000n,
      twapOut: null,
    });
    expect(curve.empty).toBe(false);
    expect(curve.requiredOut).toHaveLength(20);
    expect(curve.requiredOut[0]?.tSec).toBe(0);
    expect(curve.twap.value).toBe("unavailable");
  });
});
