import { permit2TypedData, type Address, type Intent } from "@rival/intent";
import type { Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { formatUnitsFixed } from "../lib/format.ts";

export interface SignIntentArgs {
  account: PrivateKeyAccount;
  intent: Intent;
  permit2: Address;
  settlement: Address;
  chainId: number;
  sellSymbol: string;
  buySymbol: string;
  sellDecimals: number;
  buyDecimals: number;
}

function plainAmount(value: bigint, decimals: number): string {
  const truncated = formatUnitsFixed(value, decimals, 1);
  const negative = truncated.startsWith("-");
  const body = negative ? truncated.slice(1) : truncated;
  const withDecimal = body.includes(".") ? body : `${body}.0`;
  const [whole, frac] = withDecimal.split(".");
  const grouped = (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const text = frac === undefined ? grouped : `${grouped}.${frac}`;
  return negative ? `-${text}` : text;
}

function formatExpiry(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
}

/** Plain-language signing dialog. The amount is the hard floor; the clock time is the deadline. */
export function signingSummary(args: {
  amountIn: bigint;
  hardMinOut: bigint;
  deadline: number;
  sellSymbol: string;
  buySymbol: string;
  sellDecimals: number;
  buyDecimals: number;
}): string {
  const sell = plainAmount(args.amountIn, args.sellDecimals);
  const floor = plainAmount(args.hardMinOut, args.buyDecimals);
  const expiry = formatExpiry(args.deadline);
  return `Sell ${sell} ${args.sellSymbol}. You will receive at least ${floor} ${args.buySymbol}. Tokens leave your wallet only if a solver delivers that amount before ${expiry}.`;
}

/** Sign the Permit2 witness typed data from `@rival/intent` and return the human summary. */
export async function signIntent(args: SignIntentArgs): Promise<{ signature: Hex; summary: string }> {
  if (args.account.address.toLowerCase() !== args.intent.maker.toLowerCase()) {
    throw new Error("signer is not the maker");
  }
  const typed = permit2TypedData({
    intent: args.intent,
    permit2: args.permit2,
    settlement: args.settlement,
    chainId: args.chainId,
  });
  const signature = await args.account.signTypedData({
    domain: typed.domain,
    types: typed.types,
    primaryType: typed.primaryType,
    message: typed.message,
  });
  return {
    signature,
    summary: signingSummary({
      amountIn: args.intent.amountIn,
      hardMinOut: args.intent.hardMinOut,
      deadline: args.intent.deadline,
      sellSymbol: args.sellSymbol,
      buySymbol: args.buySymbol,
      sellDecimals: args.sellDecimals,
      buyDecimals: args.buyDecimals,
    }),
  };
}
