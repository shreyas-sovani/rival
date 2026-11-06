import { formatUnitsFixed } from "../lib/format.ts";
import type { IntentComposerVM } from "../viewmodels/intent-composer.ts";

/**
 * Format an already-fetched pool quote and hook TWAP into the Trade composer fields.
 * Does not call a chain. `poolQuote` and `twap` are `IntentComposerVM` properties.
 */
export function tradeQuoteFields(result: {
  poolQuote: bigint;
  twap: bigint;
  decimals: number;
  symbol: string;
}): Pick<IntentComposerVM, "poolQuote" | "twap"> {
  const text = (amount: bigint) => `${formatUnitsFixed(amount, result.decimals, 4)} ${result.symbol}`;
  return {
    poolQuote: text(result.poolQuote),
    twap: text(result.twap),
  };
}
