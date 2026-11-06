import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  describeFaucetFailure,
  faucetIsStocked,
  parseBookFeed,
  previewCurve,
  sellBalanceAllowsSubmit,
  sellBalanceBlockMessage,
} from "./runner.ts";

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

  it("enables a claim when health is a reachable object", () => {
    expect(faucetIsStocked({ house: { eth: "1", tWETH: "5", tUSDC: "10" } })).toBe(true);
    expect(faucetIsStocked({ house: { eth: "1", tWETH: "0", tUSDC: "0" } })).toBe(true);
    expect(faucetIsStocked({ faucet: { stocked: false }, house: { tWETH: "0", tUSDC: "0" } })).toBe(true);
    expect(faucetIsStocked({})).toBe(true);
    expect(faucetIsStocked(null)).toBe(false);
    expect(faucetIsStocked(undefined)).toBe(false);
    expect(faucetIsStocked("down")).toBe(false);
    expect(faucetIsStocked(0)).toBe(false);
  });

  it("keeps a single curve on the trade page", () => {
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    expect(page.includes("CurveChartView")).toBe(false);
  });

  it("does not call the faucet empty just because health loaded", () => {
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    expect(page.includes("The faucet is empty.")).toBe(false);
    expect(page.includes("1 tUSDC base")).toBe(false);
  });

  it("pairs a faucet error code with the runner message", () => {
    expect(
      describeFaucetFailure(
        { code: "INVALID_SIGNATURE", message: "faucet signature does not recover to wallet" },
        400,
      ),
    ).toBe("INVALID_SIGNATURE faucet signature does not recover to wallet");
    expect(describeFaucetFailure(null, 500)).toBe("Request failed (500)");
  });

  it("blocks publish when the burner tWETH balance is unknown or short", () => {
    expect(sellBalanceAllowsSubmit(null, 10n ** 18n)).toBe(false);
    expect(sellBalanceAllowsSubmit(0n, 10n ** 18n)).toBe(false);
    expect(sellBalanceAllowsSubmit(10n ** 18n - 1n, 10n ** 18n)).toBe(false);
    expect(sellBalanceAllowsSubmit(10n ** 18n, 10n ** 18n)).toBe(true);
    expect(sellBalanceBlockMessage(0n, 10n ** 18n)).toBe("Get test tokens first");
    expect(sellBalanceBlockMessage(null, 10n ** 18n)).toBeNull();
    expect(sellBalanceBlockMessage(10n ** 18n, 10n ** 18n)).toBeNull();
  });

  it("checks the raw sell balance before signing", () => {
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    const submit = page.slice(page.indexOf("async function onSubmit"), page.indexOf("async function onFaucet"));
    const guard = submit.indexOf("sellBalanceAllowsSubmit");
    const sign = submit.indexOf("signIntent(");
    expect(guard).toBeGreaterThan(-1);
    expect(sign).toBeGreaterThan(guard);
  });
});

describe("trade curve preview", () => {
  it("does not plot an offline 1 tUSDC curve when the pool quote is missing", () => {
    const preview = previewCurve("balanced", "absolute", null, null);
    expect(preview.curve.empty).toBe(true);
    expect(preview.curve.requiredOut).toEqual([]);
    expect(preview.curve.poolQuote.value).toBe("unavailable");
    expect(preview.curve.twap.value).toBe("unavailable");
    expect(preview.curve.hardFloor.value).toBe("unavailable");
  });

  it("does not plot a pegged curve without a TWAP", () => {
    const preview = previewCurve("balanced", "pegged", 2_000_000n, null);
    expect(preview.curve.empty).toBe(true);
    expect(preview.curve.requiredOut).toEqual([]);
    expect(preview.curve.twap.value).toBe("unavailable");
    expect(preview.curve.poolQuote.value).not.toBe("unavailable");
  });

  it("plots a live pool quote without inventing a TWAP", () => {
    const preview = previewCurve("balanced", "absolute", 2_000_000n, null);
    expect(preview.curve.empty).toBe(false);
    expect(preview.curve.requiredOut.length).toBeGreaterThan(0);
    expect(preview.curve.poolQuote.value).toContain("tUSDC");
    expect(preview.curve.twap.value).toBe("unavailable");
  });
});
