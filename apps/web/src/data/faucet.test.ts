import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { faucetClaimTypedData } from "../../../runner/src/handlers/faucet.ts";
import { buildFaucetClaimTypedData, mapFaucetClaimError } from "./faucet.ts";
import { publicDeployment } from "./public-deployment.ts";

const tWETH = publicDeployment.tokens.tWETH as Address;

describe("faucet claim typed data", () => {
  it("matches the runner FaucetClaim for Sepolia tWETH", () => {
    const wallet = "0x0000000000000000000000000000000000000001" as Address;
    const day = 20_412;
    const kind = "tokens" as const;
    const signed = buildFaucetClaimTypedData({ wallet, day, kind });
    const verified = faucetClaimTypedData({
      wallet,
      day,
      kind,
      chainId: 11155111,
      verifyingContract: tWETH,
    });

    expect(signed.domain.name).toBe("RivalFaucet");
    expect(signed.domain.name).toBe(verified.domain.name);
    expect(signed.domain.version).toBe("1");
    expect(signed.domain.version).toBe(verified.domain.version);
    expect(signed.domain.chainId).toBe(11155111);
    expect(signed.domain.chainId).toBe(verified.domain.chainId);
    expect(signed.domain.verifyingContract).toBe(tWETH);
    expect(signed.domain.verifyingContract).toBe(verified.domain.verifyingContract);
    expect(signed.types).toEqual(verified.types);
    expect(signed.primaryType).toBe("FaucetClaim");
    expect(signed.primaryType).toBe(verified.primaryType);
    expect(signed.message.wallet).toBe(wallet);
    expect(signed.message.wallet).toBe(verified.message.wallet);
    expect(signed.message.day).toBe(BigInt(day));
    expect(signed.message.day).toBe(verified.message.day);
    expect(signed.message.kind).toBe(kind);
    expect(signed.message.kind).toBe(verified.message.kind);
    expect(signed).toEqual(verified);
  });
});

describe("faucet claim errors", () => {
  it("hides signature and minter failures", () => {
    const sentence = "claim failed, try again";
    for (const raw of [
      "INVALID_SIGNATURE",
      "faucet signature does not recover to wallet",
      "NotMinter()",
      'The contract function "mint" reverted with the following reason:\nNotMinter()',
      "Request failed (400) INVALID_SIGNATURE faucet signature does not recover to wallet",
    ]) {
      expect(mapFaucetClaimError(raw)).toBe(sentence);
    }
  });

  it("names the once-per-day limit without the runner status", () => {
    expect(mapFaucetClaimError("faucet claim already used for this wallet and day")).toBe("already claimed today");
    expect(mapFaucetClaimError("Request failed (429) faucet claim already used for this wallet and day")).toBe(
      "already claimed today",
    );
  });

  it("says the faucet is empty only for an unstocked or reverted mint", () => {
    expect(mapFaucetClaimError("faucet ETH stock is empty")).toBe("The faucet is empty.");
    expect(mapFaucetClaimError("token mint reverted")).toBe("The faucet is empty.");
    expect(mapFaucetClaimError('The contract function "mint" reverted.')).toBe("The faucet is empty.");
  });

  it("leaves other faucet failures as a short sentence", () => {
    expect(mapFaucetClaimError("faucet IP cap reached for this day")).toBe("faucet IP cap reached for this day");
    expect(mapFaucetClaimError("faucet day is not the current UTC day")).toBe("faucet day is not the current UTC day");
  });
});
