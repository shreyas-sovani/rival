import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { decodeFunctionData, encodeFunctionData, parseAbi, toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import recorded from "./fixtures/sepolia-quoter.json" with { type: "json" };
import { encodeFill, type FillParams } from "./fill.ts";
import { arb, sprint } from "./strategies.ts";
import type { Address, Hex, Intent } from "./types.ts";
import { intentStructHash, permit2WitnessTypedData } from "./witness.ts";

const QUOTE_A = BigInt(recorded.pools.A.amountOut);
const QUOTE_B = BigInt(recorded.pools.B.amountOut);
const AMOUNT_IN = BigInt(recorded.amountIn);
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const RECIPIENT = "0x4444444444444444444444444444444444444444" as Address;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;

/** Independent of `fill.ts`. Selector ignores names; this string is the canonical type order. */
const FILL_SELECTOR = toFunctionSelector(
  "function fill((address,address,address,uint128,address,uint8,uint128,uint32,int32,int32,uint32,uint32,uint32,uint128,uint8,bytes32,uint256),bytes,(address,bool,bytes,bytes32[]))",
);

const SPEC_ABI = parseAbi([
  "function fill((address maker, address tokenIn, address tokenOut, uint128 amountIn, address recipient, uint8 mode, uint128 baseOut, uint32 oracleWindow, int32 startBps, int32 floorBps, uint32 startTime, uint32 decaySecs, uint32 deadline, uint128 hardMinOut, uint8 gate, bytes32 allowlistHash, uint256 nonce) i, bytes makerSig, (address inputTo, bool useCallback, bytes data, bytes32[] allowLabels) p)",
]);

describe("encodeFill", () => {
  it("encodes the 1 tWETH quote as the hard floor; sprint would submit it and arb would not", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const solver = privateKeyToAccount(generatePrivateKey());
    const intent: Intent = {
      maker: account.address,
      tokenIn: recorded.tokenIn as Address,
      tokenOut: recorded.tokenOut as Address,
      amountIn: AMOUNT_IN,
      recipient: RECIPIENT,
      mode: 0,
      baseOut: 0n,
      oracleWindow: 60,
      startBps: 0,
      floorBps: -1,
      startTime: 1_700_000_000,
      decaySecs: 100,
      deadline: 1_700_000_100,
      hardMinOut: QUOTE_A,
      gate: 0,
      allowlistHash: ZERO_BYTES32,
      nonce: 7n,
    };
    const signature = await account.signTypedData(
      permit2WitnessTypedData({
        intent,
        permit2: PERMIT2,
        settlement: SETTLEMENT,
        chainId: recorded.chainId,
      }),
    );
    const params: FillParams = {
      inputTo: solver.address,
      useCallback: false,
      data: "0x",
      allowLabels: [],
    };

    const encoded = encodeFill(intent, signature, params);

    expect(AMOUNT_IN).toBe(10n ** 18n);
    expect(QUOTE_A).toBe(2_998_350_157n);
    expect(encoded.intentHash).toBe(intentStructHash(intent));
    expect(encoded.calldata.slice(0, 10)).toBe(FILL_SELECTOR);
    expect(encoded.calldata).toBe(
      encodeFunctionData({
        abi: SPEC_ABI,
        functionName: "fill",
        args: [intent, signature, params],
      }),
    );

    const decoded = decodeFunctionData({ abi: SPEC_ABI, data: encoded.calldata });
    expect(decoded.functionName).toBe("fill");
    const [filled, makerSig, fillParams] = decoded.args;
    expect(filled.hardMinOut).toBe(QUOTE_A);
    expect(filled.amountIn).toBe(AMOUNT_IN);
    expect(filled.maker).toBe(account.address);
    expect(filled.tokenIn).toBe(intent.tokenIn);
    expect(filled.tokenOut).toBe(intent.tokenOut);
    expect(filled.startBps).toBe(0);
    expect(filled.floorBps).toBe(-1);
    expect(makerSig).toBe(signature);
    expect(fillParams.inputTo).toBe(solver.address);
    expect(fillParams.useCallback).toBe(false);

    const decision = {
      elapsed: 0n,
      decaySecs: BigInt(filled.decaySecs),
      startBps: BigInt(filled.startBps),
      floorBps: BigInt(filled.floorBps),
      quoteOut: QUOTE_A,
      costOut: 0n,
      hardMinOut: filled.hardMinOut,
      otherQuoteOut: QUOTE_B,
    };
    expect(sprint(decision)).toEqual({ fill: true, reason: "covers required" });
    expect(arb(decision)).toEqual({ fill: false, reason: "gap within cost" });
  });
});
