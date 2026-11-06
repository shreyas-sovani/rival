import { verifyTypedData } from "viem";
import type { FaucetClaims } from "../services/limits.ts";
import type { RunnerDeps } from "../services/deps.ts";
import { ApiError, type Address, type FaucetRequest, type FaucetResponse } from "./types.ts";

export const FAUCET_DOMAIN_NAME = "RivalFaucet";
export const FAUCET_DOMAIN_VERSION = "1";

/** The only EIP-712 `FaucetClaim` definition. Handler and tests both use this object. */
export const FAUCET_CLAIM_TYPES = {
  FaucetClaim: [
    { name: "wallet", type: "address" },
    { name: "day", type: "uint256" },
    { name: "kind", type: "string" },
  ],
} as const;

export function faucetClaimTypedData(args: {
  wallet: Address;
  day: number;
  kind: "tokens" | "eth";
  chainId: number;
  verifyingContract: Address;
}) {
  return {
    domain: {
      name: FAUCET_DOMAIN_NAME,
      version: FAUCET_DOMAIN_VERSION,
      chainId: args.chainId,
      verifyingContract: args.verifyingContract,
    },
    types: FAUCET_CLAIM_TYPES,
    primaryType: "FaucetClaim" as const,
    message: {
      wallet: args.wallet,
      day: BigInt(args.day),
      kind: args.kind,
    },
  };
}

export async function faucet(deps: RunnerDeps, claims: FaucetClaims, req: FaucetRequest): Promise<FaucetResponse> {
  if (req.kind !== "tokens" && req.kind !== "eth") {
    throw new ApiError("INVALID_PARAMS", "faucet kind is not tokens or eth");
  }
  if (!Number.isInteger(req.day) || req.day < 0) {
    throw new ApiError("INVALID_PARAMS", "faucet day is not a UTC day index");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(req.wallet)) {
    throw new ApiError("INVALID_PARAMS", "faucet wallet is not an address");
  }

  const typed = faucetClaimTypedData({
    wallet: req.wallet,
    day: req.day,
    kind: req.kind,
    chainId: deps.chain.chainId,
    verifyingContract: deps.chain.faucet,
  });
  let signed = false;
  try {
    signed = await verifyTypedData({
      address: req.wallet,
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
      signature: req.signature,
    });
  } catch {
    signed = false;
  }
  if (!signed) {
    throw new ApiError("INVALID_SIGNATURE", "faucet signature does not recover to wallet");
  }

  const today = Math.floor(deps.clock() / 86_400);
  if (req.day !== today) {
    throw new ApiError("INVALID_PARAMS", "faucet day is not the current UTC day");
  }

  if (req.kind === "eth") {
    const remaining = await deps.ethRemaining();
    if (!Number.isInteger(remaining) || remaining <= 0) {
      throw new ApiError("RATE_LIMITED", "faucet ETH stock is empty");
    }
  }

  claims.take(req.wallet, req.day, req.kind, deps.clientIp());
  const txHash = await deps.mint(req);
  return { txHash, nextEligibleAt: (req.day + 1) * 86_400 };
}
