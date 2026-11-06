import { quoteCost } from "./quote.ts";
import type { ArkivOpenBook, SettlementFacts, VenueQuoter } from "./ports.ts";
import type { Address, Hex } from "./types.ts";
import { readIntent, verifyIntent, type VerifyIntentArgs, type VerifyIntentResult } from "./verify.ts";

/** Pull balance and nonce through `SettlementFacts`, then run `verifyIntent`. */
export async function screenIntent(
  settlement: SettlementFacts,
  args: Omit<VerifyIntentArgs, "balance" | "nonceUsed">,
): Promise<VerifyIntentResult> {
  const intent = readIntent(args.intent);
  if (!intent) return { accept: false, reason: "bad params" };
  const [balance, nonceUsed] = await Promise.all([
    settlement.balanceOf(intent.maker, intent.tokenIn),
    settlement.nonceUsed(intent.maker, intent.nonce),
  ]);
  return verifyIntent({ ...args, balance, nonceUsed });
}

export async function netQuote(
  quoter: VenueQuoter,
  args: {
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    venue: "hooked" | "other";
    gasUnits: bigint;
    gasPriceWei: bigint;
    tokenOutPerEth: bigint;
  },
): Promise<bigint> {
  const quoteOut = await quoter.quoteExactInput({
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
    amountIn: args.amountIn,
    venue: args.venue,
  });
  return quoteCost({
    quoteOut,
    gasUnits: args.gasUnits,
    gasPriceWei: args.gasPriceWei,
    tokenOutPerEth: args.tokenOutPerEth,
  });
}

export async function listCandidates(
  book: ArkivOpenBook,
  now: bigint,
): Promise<readonly { intentJson: string; signature: Hex }[]> {
  return book.listOpen(now);
}
