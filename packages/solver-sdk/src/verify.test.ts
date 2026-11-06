import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { intentTypedData } from "./intent-type.ts";
import type { Address, Intent } from "./types.ts";
import { verifyIntent } from "./verify.ts";
import { listCandidates, netQuote, screenIntent } from "./adapters.ts";

const CHAIN_ID = 11155111;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const TOKEN_IN = "0x2222222222222222222222222222222222222222" as const;
const TOKEN_OUT = "0x3333333333333333333333333333333333333333" as const;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;

function sample(maker: Address, overrides: Partial<Intent> = {}): Intent {
  return {
    maker,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: 10n ** 18n,
    recipient: maker,
    mode: 0,
    baseOut: 3_000_000_000n,
    oracleWindow: 0,
    startBps: 20,
    floorBps: -30,
    startTime: 1_700_000_000,
    decaySecs: 90,
    deadline: 1_700_000_120,
    hardMinOut: 2_955_000_000n,
    gate: 0,
    allowlistHash: ZERO_BYTES32,
    nonce: 7n,
    ...overrides,
  };
}

async function signed(intent: Intent, key = generatePrivateKey()) {
  const account = privateKeyToAccount(key);
  const typed = intentTypedData({ ...intent, maker: account.address }, CHAIN_ID, SETTLEMENT);
  const signature = await account.signTypedData(typed);
  return { account, intent: { ...intent, maker: account.address }, signature };
}

describe("verifyIntent", () => {
  it("accepts a signature from a local account", async () => {
    const { intent, signature } = await signed(sample("0x0000000000000000000000000000000000000001"));
    const json = JSON.stringify({
      ...intent,
      amountIn: intent.amountIn.toString(),
      baseOut: intent.baseOut.toString(),
      hardMinOut: intent.hardMinOut.toString(),
      nonce: intent.nonce.toString(),
    });
    expect(
      await verifyIntent({
        intent: json,
        signature,
        balance: intent.amountIn,
        nonceUsed: false,
        now: BigInt(intent.deadline),
        chainId: CHAIN_ID,
        verifyingContract: SETTLEMENT,
      }),
    ).toEqual({ accept: true });
  });

  it("returns forged, expired, insufficient balance, nonce used, and bad params", async () => {
    const { account, intent, signature } = await signed(sample("0x0000000000000000000000000000000000000001"));
    const other = await signed(intent, generatePrivateKey());
    const base = {
      intent,
      signature,
      balance: intent.amountIn,
      nonceUsed: false,
      now: BigInt(intent.deadline),
      chainId: CHAIN_ID,
      verifyingContract: SETTLEMENT,
    };

    expect(await verifyIntent({ ...base, signature: other.signature })).toEqual({ accept: false, reason: "forged" });
    expect(await verifyIntent({ ...base, now: BigInt(intent.deadline) + 1n })).toEqual({
      accept: false,
      reason: "expired",
    });
    expect(await verifyIntent({ ...base, balance: intent.amountIn - 1n })).toEqual({
      accept: false,
      reason: "insufficient balance",
    });
    expect(await verifyIntent({ ...base, nonceUsed: true })).toEqual({ accept: false, reason: "nonce used" });
    expect(await verifyIntent({ ...base, intent: { ...intent, decaySecs: 9 } })).toEqual({
      accept: false,
      reason: "bad params",
    });
    expect(account.address).toBe(intent.maker);
  });

  it("reads settlement, the quoter, and the book through injected interfaces", async () => {
    const { intent, signature } = await signed(sample("0x0000000000000000000000000000000000000001"));
    const screened = await screenIntent(
      {
        balanceOf: async () => intent.amountIn,
        nonceUsed: async () => false,
      },
      {
        intent,
        signature,
        now: BigInt(intent.startTime),
        chainId: CHAIN_ID,
        verifyingContract: SETTLEMENT,
      },
    );
    expect(screened).toEqual({ accept: true });

    const net = await netQuote(
      {
        quoteExactInput: async () => 1_000_000n,
      },
      {
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amountIn: intent.amountIn,
        venue: "hooked",
        gasUnits: 100_000n,
        gasPriceWei: 1_000_000_000n,
        tokenOutPerEth: 3_000_000_000n,
      },
    );
    expect(net).toBe(700_000n);

    const rows = await listCandidates(
      {
        listOpen: async () => [{ intentJson: "{}", signature }],
      },
      1n,
    );
    expect(rows).toHaveLength(1);
  });
});
