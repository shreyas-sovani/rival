import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { faucetIsStocked, parseBookFeed } from "./runner.ts";

describe("runner client", () => {
  it("parses an open-book feed without inventing rows", () => {
    const feed = parseBookFeed({
      rows: [
        {
          intentHash: `0x${"ab".repeat(32)}`,
          maker: "0x0000000000000000000000000000000000000001",
          pair: "tWETH/tUSDC",
          amountIn: "1000000000000000000",
          mode: 0,
          gate: 1,
          status: "open",
          deadline: 1_700_000_100,
          signatureOk: true,
          chainStatus: "open",
          entityKey: "entity-1",
          floor: "2940000000",
        },
      ],
      presence: 2,
      asOf: 1_700_000_000,
      source: "arkiv",
    });
    expect(feed.presence).toBe(2);
    expect(feed.source).toBe("arkiv");
    expect(feed.rows).toHaveLength(1);
    expect(feed.rows[0]?.amountIn).toBe(10n ** 18n);
    expect(feed.rows[0]?.floor).toBe("2940000000");
    expect(feed.rows[0]?.entityKey).toBe("entity-1");
  });

  it("rejects a feed that does not name its source", () => {
    expect(() => parseBookFeed({ rows: [], presence: 0, asOf: 1, source: "cache" })).toThrow(/source/);
  });

  it("treats positive house token balances as a stocked faucet", () => {
    expect(faucetIsStocked({ house: { eth: "1", tWETH: "5", tUSDC: "10" } })).toBe(true);
    expect(faucetIsStocked({ house: { eth: "1", tWETH: "0", tUSDC: "10" } })).toBe(false);
    expect(faucetIsStocked({ faucet: { stocked: true }, house: { tWETH: "0", tUSDC: "0" } })).toBe(true);
  });

  it("keeps a single curve on the trade page", () => {
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    expect(page.includes("CurveChartView")).toBe(false);
  });
});
