import type { Address, Hex } from "./types.ts";

/** Open-book read. Callers pass an Arkiv client that satisfies this; the SDK does not import Arkiv. */
export interface ArkivOpenBook {
  listOpen(now: bigint): Promise<readonly { intentJson: string; signature: Hex }[]>;
}

/** Exact-input venue quote. `hooked` is the oracle pool; `other` is the second venue. */
export interface VenueQuoter {
  quoteExactInput(args: {
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    venue: "hooked" | "other";
  }): Promise<bigint>;
}

/** Settlement and balance reads the verifier needs. No transaction submission. */
export interface SettlementFacts {
  balanceOf(maker: Address, token: Address): Promise<bigint>;
  nonceUsed(maker: Address, nonce: bigint): Promise<boolean>;
}
