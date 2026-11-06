import { describe, expect, it } from "vitest";
import type { IntentComposerVM } from "../viewmodels/intent-composer.ts";
import { tradeQuoteFields } from "./quotes.ts";

describe("trade quotes", () => {
  it("returns the Trade composer poolQuote and twap fields", () => {
    const fields: Pick<IntentComposerVM, "poolQuote" | "twap"> = tradeQuoteFields({
      poolQuote: 3_000_000_000n,
      twap: 2_990_500_000n,
      decimals: 6,
      symbol: "tUSDC",
    });

    expect(fields).toEqual({
      poolQuote: "3000 tUSDC",
      twap: "2990.5 tUSDC",
    });
  });
});
