import type { Address, Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { CHAIN_ID, FAUCET_VERIFYING_CONTRACT } from "./runner.ts";

const FAUCET_TYPES = {
  FaucetClaim: [
    { name: "wallet", type: "address" },
    { name: "day", type: "uint256" },
    { name: "kind", type: "string" },
  ],
} as const;

/** EIP-712 payload the burner signs. Domain must match the runner's `faucetClaimTypedData`. */
export function buildFaucetClaimTypedData(args: {
  wallet: Address;
  day: number;
  kind: "tokens" | "eth";
}) {
  return {
    domain: {
      name: "RivalFaucet",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: FAUCET_VERIFYING_CONTRACT,
    },
    types: FAUCET_TYPES,
    primaryType: "FaucetClaim" as const,
    message: {
      wallet: args.wallet,
      day: BigInt(args.day),
      kind: args.kind,
    },
  };
}

/** EIP-712 `FaucetClaim` over wallet, UTC day, and kind. Matches the runner handler. */
export async function signFaucetClaim(args: {
  account: PrivateKeyAccount;
  day: number;
  kind: "tokens" | "eth";
}): Promise<Hex> {
  const wallet = args.account.address as Address;
  return args.account.signTypedData(buildFaucetClaimTypedData({ wallet, day: args.day, kind: args.kind }));
}

const CLAIM_FAILED = "claim failed, try again";
const ALREADY_CLAIMED = "already claimed today";
const FAUCET_EMPTY = "The faucet is empty.";

/** Copy for a failed `/api/faucet` claim. Hides runner codes and status numbers. */
export function mapFaucetClaimError(raw: string): string {
  const text = raw.trim();
  if (
    text.includes("INVALID_SIGNATURE") ||
    text.includes("faucet signature does not recover to wallet") ||
    text.includes("NotMinter")
  ) {
    return CLAIM_FAILED;
  }
  if (text.includes("faucet claim already used for this wallet and day")) {
    return ALREADY_CLAIMED;
  }
  if (/empty stock|stock is empty|mint["']?\s+reverted/i.test(text)) {
    return FAUCET_EMPTY;
  }
  const line = text.split("\n")[0]?.trim() ?? "";
  return line === "" ? "The faucet claim failed." : line;
}

export function utcDay(nowUnixSec = Math.floor(Date.now() / 1000)): number {
  return Math.floor(nowUnixSec / 86_400);
}
