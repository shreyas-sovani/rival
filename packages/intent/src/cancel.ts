import { recoverTypedDataAddress, type Hex } from "viem";
import type { Address } from "./types.ts";

const CANCEL_TYPES = {
  Cancel: [
    { name: "intentHash", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/**
 * Recover the maker of an EIP-712 `Cancel(bytes32 intentHash,uint256 deadline)` signature.
 * The settlement domain is `RivalSettlement` version `1`. Returns false when the signature
 * does not recover an address. The settlement treats a zero signer as `BadSignature`.
 */
export async function verifyCancelSignature(args: {
  intentHash: Hex;
  deadline: bigint;
  signature: Hex;
  chainId: number;
  verifyingContract: Address;
}): Promise<boolean> {
  try {
    const recovered = await recoverTypedDataAddress({
      domain: {
        name: "RivalSettlement",
        version: "1",
        chainId: args.chainId,
        verifyingContract: args.verifyingContract,
      },
      types: CANCEL_TYPES,
      primaryType: "Cancel",
      message: { intentHash: args.intentHash, deadline: args.deadline },
      signature: args.signature,
    });
    return recovered !== "0x0000000000000000000000000000000000000000";
  } catch {
    return false;
  }
}
