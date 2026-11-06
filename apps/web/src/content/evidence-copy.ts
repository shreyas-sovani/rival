/** PRD §5.8 evidence column, copied. */
export const SPONSOR_EVIDENCE = {
  uniswap:
    "Hook address flag bits; pools on the official PoolManager; Permit2 witness pulls in `Filled` txs; flash-accounting swap in solver callback trace",
  ens: "Names resolve via UniversalResolverV2; forge-record revert; gated-fill revert; expiry/exit; ENSIP-25/26 records on solver names",
  arkiv:
    "Entity keys/owners; README query; solver bots demonstrably read Arkiv; degraded banner when blocked",
} as const;

/** PRD §8.1 known-limit sentence, without the markdown bold markers. */
export const KNOWN_LIMIT_BODY =
  "reputation can be farmed by self-dealing wallets; self-fills (`solver == maker/recipient`) are blocked and `makers` is exposed so consumers can discount";

export const KNOWN_LIMIT = `Known limit: ${KNOWN_LIMIT_BODY}`;
