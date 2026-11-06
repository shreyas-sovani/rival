import type { Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { CHAIN_ID, settlementAddress } from "./runner.ts";

const CANCEL_TYPES = {
  Cancel: [
    { name: "intentHash", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** EIP-712 `Cancel(bytes32 intentHash,uint256 deadline)` in the settlement domain. */
export async function signCancel(account: PrivateKeyAccount, intentHash: Hex, deadline: number): Promise<Hex> {
  return account.signTypedData({
    domain: {
      name: "RivalSettlement",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: settlementAddress(),
    },
    types: CANCEL_TYPES,
    primaryType: "Cancel",
    message: {
      intentHash,
      deadline: BigInt(deadline),
    },
  });
}
