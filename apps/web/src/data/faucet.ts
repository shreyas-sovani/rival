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

/** EIP-712 `FaucetClaim` over wallet, UTC day, and kind. Matches the runner handler. */
export async function signFaucetClaim(args: {
  account: PrivateKeyAccount;
  day: number;
  kind: "tokens" | "eth";
}): Promise<Hex> {
  const wallet = args.account.address as Address;
  return args.account.signTypedData({
    domain: {
      name: "RivalFaucet",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: FAUCET_VERIFYING_CONTRACT,
    },
    types: FAUCET_TYPES,
    primaryType: "FaucetClaim",
    message: {
      wallet,
      day: BigInt(args.day),
      kind: args.kind,
    },
  });
}

export function utcDay(nowUnixSec = Math.floor(Date.now() / 1000)): number {
  return Math.floor(nowUnixSec / 86_400);
}
