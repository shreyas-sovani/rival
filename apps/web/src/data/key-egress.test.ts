import { buildIntent } from "@rival/intent";
import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "../wallet/storage.ts";
import { createEncryptedWallet, unlockWallet } from "../wallet/wallet.ts";
import { postSignedIntent } from "./egress.ts";
import { signIntent } from "./signing.ts";

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const TOKEN_IN = "0x2222222222222222222222222222222222222222" as const;
const TOKEN_OUT = "0x3333333333333333333333333333333333333333" as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

function capturedUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.href;
  if (typeof input === "string") return input;
  return input.url;
}

describe("wallet key egress", () => {
  it("never puts the plaintext key in a fetch body or URL", async () => {
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: capturedUrl(input),
        body: typeof init?.body === "string" ? init.body : "",
      });
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    const storage = memoryStorage(new Map());
    await createEncryptedWallet("correct horse", storage);
    const wallet = await unlockWallet("correct horse", storage);
    const deadline = Date.UTC(2026, 10, 6, 14, 32, 10) / 1000;
    const intent = buildIntent({
      maker: wallet.address,
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: 10n ** 18n,
      mode: 0,
      baseOut: 2_988_000_000n,
      startTime: deadline - 150,
      deadline,
      hardMinOut: 2_988_000_000n,
      nonce: 1n,
    });
    const signed = await signIntent({
      account: wallet.account,
      intent,
      permit2: PERMIT2,
      settlement: SETTLEMENT,
      chainId: 11155111,
      sellSymbol: "tWETH",
      buySymbol: "tUSDC",
      sellDecimals: 18,
      buyDecimals: 6,
    });
    await postSignedIntent({
      endpoint: "https://publisher.example/api/intents",
      wallet,
      signature: signed.signature,
      summary: signed.summary,
    });

    expect(calls.length).toBeGreaterThan(0);
    const bare = wallet.privateKey.slice(2).toLowerCase();
    for (const call of calls) {
      expect(call.url.includes(wallet.privateKey)).toBe(false);
      expect(call.body.includes(wallet.privateKey)).toBe(false);
      expect(call.url.toLowerCase().includes(bare)).toBe(false);
      expect(call.body.toLowerCase().includes(bare)).toBe(false);
    }
  });
});
