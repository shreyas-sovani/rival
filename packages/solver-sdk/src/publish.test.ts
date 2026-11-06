import { readFileSync } from "node:fs";
import { buildIntent, hardFloorFromQuote, verifyIntentSignature } from "@rival/intent";
import { getAddress, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { signAndPublish } from "./publish.ts";

const deployment = JSON.parse(readFileSync(new URL("../../../deployments/sepolia.json", import.meta.url), "utf8")) as {
  settlement: string;
  tokens: { tWETH: string; tUSDC: string };
};

const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
const SETTLEMENT = getAddress(deployment.settlement);
const TOKEN_IN = getAddress(deployment.tokens.tWETH);
const TOKEN_OUT = getAddress(deployment.tokens.tUSDC);
const NOW = 1_700_000_000;
const NONCE = 9n;
const QUOTE = 3_000_000_000n;
const HASH = `0x${"ab".repeat(32)}` as Hex;
const ENTITY = `0x${"cd".repeat(32)}`;

describe("signAndPublish", () => {
  it("posts the web wire body for one tWETH and returns the runner receipt", async () => {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const previous = process.env.NEXT_PUBLIC_RUNNER_URL;
    process.env.NEXT_PUBLIC_RUNNER_URL = "http://runner.test/";
    const expected = buildIntent({
      maker: account.address,
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: 10n ** 18n,
      preset: "balanced",
      mode: 0,
      gate: 0,
      startTime: NOW,
      nonce: NONCE,
      oracleQuoteOut: QUOTE,
      baseOut: QUOTE,
    });
    let posted: { url: string; body: { intent: Record<string, unknown>; signature: Hex } } | undefined;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      posted = { url, body: JSON.parse(String(init?.body)) as { intent: Record<string, unknown>; signature: Hex } };
      return new Response(JSON.stringify({ intentHash: HASH, entityKey: ENTITY, degraded: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    try {
      const result = await signAndPublish(
        { sell: "1", preset: "balanced", gate: "open", mode: "absolute", key, rpc: "http://127.0.0.1:1" },
        { fetch: fetchImpl, quoteOut: QUOTE, now: NOW, nonce: NONCE },
      );
      expect(result).toEqual({ intentHash: HASH, entityKey: ENTITY, degraded: false });
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_RUNNER_URL;
      else process.env.NEXT_PUBLIC_RUNNER_URL = previous;
    }

    expect(posted?.url).toBe("http://runner.test/api/intents");
    expect(posted?.body.intent).toEqual({
      maker: expected.maker,
      tokenIn: expected.tokenIn,
      tokenOut: expected.tokenOut,
      amountIn: expected.amountIn.toString(),
      recipient: expected.recipient,
      mode: expected.mode,
      baseOut: expected.baseOut.toString(),
      oracleWindow: expected.oracleWindow,
      startBps: expected.startBps,
      floorBps: expected.floorBps,
      startTime: expected.startTime,
      decaySecs: expected.decaySecs,
      deadline: expected.deadline,
      hardMinOut: hardFloorFromQuote(QUOTE).toString(),
      gate: expected.gate,
      allowlistHash: expected.allowlistHash,
      nonce: expected.nonce.toString(),
    });
    expect(JSON.stringify(posted?.body)).not.toContain(key);
    expect(posted?.body.signature.startsWith("0x")).toBe(true);
    await expect(
      verifyIntentSignature({
        intent: expected,
        signature: posted!.body.signature,
        permit2: PERMIT2,
        settlement: SETTLEMENT,
        chainId: 11155111,
      }),
    ).resolves.toBe(true);
  });
});
