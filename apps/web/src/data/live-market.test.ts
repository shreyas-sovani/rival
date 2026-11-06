import { describe, expect, it } from "vitest";
import { quoteSell } from "./live-market.ts";

describe("quoteSell", () => {
  it("prices 1 tWETH near 3000 tUSDC at the live pool tick", () => {
    const out = quoteSell(-196257, 10n ** 18n);
    expect(out).toBeGreaterThan(2_990_000_000n);
    expect(out).toBeLessThan(3_010_000_000n);
  });

  it("rejects a zero amount", () => {
    expect(() => quoteSell(-196257, 0n)).toThrow(/amountIn/);
  });
});
