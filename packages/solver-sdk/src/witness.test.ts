import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { encodePacked, hashTypedData, keccak256, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { Intent } from "./types.ts";
import { permit2WitnessDigest, permit2WitnessTypedData, verifyWitness, WITNESS_TYPE_STRING } from "./witness.ts";

const CHAIN_ID = 11155111;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const TOKEN_IN = "0x2222222222222222222222222222222222222222" as const;
const TOKEN_OUT = "0x3333333333333333333333333333333333333333" as const;
const MAKER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const LABEL = `0x${"a".repeat(64)}` as Hex;
const SIGNATURE =
  "0x5841672b98037cca791fc9b5d6d44e32296431ea108b8cf295baa290ff964f423b31d05bc5495f1e6330fc6f51ec759dc6ee15a1482e7fe1cbb625fe563d2a911b" as const;

const STRUCT_HASH = "0x39eed9f09b53d1612a58ad768c8d48e172ee6d8afa9b775db00e007f49d3f77f" as const;
const PERMIT2_DIGEST = "0x4580ff53badece96246515300f5511f971a9987d2cbad010712e2c5a39910060" as const;

/** `packages/intent` `hash.test.ts` sample: balanced, pegged, nonce 7, named gate, one label. */
function fixtureIntent(): Intent {
  return {
    maker: MAKER,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: 10n ** 18n,
    recipient: MAKER,
    mode: 1,
    baseOut: 0n,
    oracleWindow: 60,
    startBps: 20,
    floorBps: -30,
    startTime: 1_700_000_000,
    decaySecs: 90,
    deadline: 1_700_000_000 + 90 + 60,
    hardMinOut: (3_000_000_000n * 9850n) / 10_000n,
    gate: 2,
    allowlistHash: keccak256(encodePacked(["bytes32"], [LABEL])),
    nonce: 7n,
  };
}

describe("permit2 witness", () => {
  it("uses RivalSettlement.WITNESS_TYPE_STRING", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../../contracts/src/RivalSettlement.sol", import.meta.url)),
      "utf8",
    );
    const match = source.match(/string public constant WITNESS_TYPE_STRING =\s*"([^"]+)"/);
    expect(match?.[1]).toBe(WITNESS_TYPE_STRING);
  });

  it("rebuilds the S2 struct hash and Permit2 digest, and recovers the maker", async () => {
    const intent = fixtureIntent();
    const args = { intent, permit2: PERMIT2, settlement: SETTLEMENT, chainId: CHAIN_ID };
    expect(intent.hardMinOut).toBe(2_955_000_000n);
    expect(permit2WitnessDigest(args)).toBe(PERMIT2_DIGEST);
    expect(hashTypedData(permit2WitnessTypedData(args))).toBe(PERMIT2_DIGEST);
    expect(
      await verifyWitness({
        ...args,
        signature: SIGNATURE,
      }),
    ).toEqual({
      accept: true,
      structHash: STRUCT_HASH,
      digest: PERMIT2_DIGEST,
      signer: MAKER,
    });

    expect(await verifyWitness({ ...args, intent: { ...intent, nonce: 8n }, signature: SIGNATURE })).toEqual({
      accept: false,
      reason: "forged",
    });
  });
});
