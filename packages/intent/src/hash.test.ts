import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { buildIntent } from "./build.ts";
import { hashIntent, permit2Digest, permit2SdkDigest, permit2TypedData, verifyIntentSignature } from "./eip712.ts";
import { INTENT_TYPE, WITNESS_TYPE_STRING } from "./types.ts";

const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const account = privateKeyToAccount(KEY);
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const TOKEN_IN = "0x2222222222222222222222222222222222222222" as const;
const TOKEN_OUT = "0x3333333333333333333333333333333333333333" as const;
const LABEL = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const domain = {
  name: "RivalSettlement",
  version: "1",
  chainId: 11155111,
  verifyingContract: SETTLEMENT,
} as const;

function sample() {
  return buildIntent({
    maker: account.address,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: 10n ** 18n,
    preset: "balanced",
    mode: 1,
    startTime: 1_700_000_000,
    nonce: 7n,
    oracleQuoteOut: 3_000_000_000n,
    gate: 2,
    allowLabels: [LABEL],
    floorBps: -30,
  });
}

describe("permit2 witness", () => {
  it("matches the permit2-sdk digest and the Permit2 type-string reconstruction", () => {
    const intent = sample();
    expect(WITNESS_TYPE_STRING.startsWith("Intent witness)")).toBe(true);
    expect(WITNESS_TYPE_STRING.endsWith("TokenPermissions(address token,uint256 amount)")).toBe(true);
    expect(WITNESS_TYPE_STRING.includes(INTENT_TYPE)).toBe(true);
    const args = { intent, permit2: PERMIT2, settlement: SETTLEMENT, chainId: 11155111 };
    expect(permit2Digest(args)).toBe(permit2SdkDigest(args));
    expect(hashIntent(intent, domain)).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("verifies a signature over the Permit2 witness and rejects a different maker", () => {
    const intent = sample();
    const typed = permit2TypedData({ intent, permit2: PERMIT2, settlement: SETTLEMENT, chainId: 11155111 });
    return account
      .signTypedData({
        domain: typed.domain,
        types: typed.types,
        primaryType: typed.primaryType,
        message: typed.message,
      })
      .then(async (signature) => {
        expect(
          await verifyIntentSignature({
            intent,
            signature,
            permit2: PERMIT2,
            settlement: SETTLEMENT,
            chainId: 11155111,
          }),
        ).toBe(true);
        expect(
          await verifyIntentSignature({
            intent: { ...intent, maker: SETTLEMENT },
            signature,
            permit2: PERMIT2,
            settlement: SETTLEMENT,
            chainId: 11155111,
          }),
        ).toBe(false);
      });
  });

  it("hashes a named allowlist as packed bytes32 words and leaves other gates at zero", () => {
    const named = sample();
    const open = buildIntent({
      maker: account.address,
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: 1n,
      startTime: 1_700_000_000,
      nonce: 1n,
      hardMinOut: 1n,
      gate: 0,
      allowLabels: [LABEL],
    });
    expect(named.allowlistHash).not.toBe(open.allowlistHash);
    expect(open.allowlistHash).toBe(`0x${"0".repeat(64)}`);
    expect(named.hardMinOut).toBe(2_955_000_000n);
    expect(named.decaySecs).toBe(90);
  });
});
