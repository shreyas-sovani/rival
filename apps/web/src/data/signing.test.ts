import { buildIntent, verifyIntentSignature } from "@rival/intent";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { signIntent } from "./signing.ts";

const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const TOKEN_IN = "0x2222222222222222222222222222222222222222" as const;
const TOKEN_OUT = "0x3333333333333333333333333333333333333333" as const;

describe("signing summary", () => {
  it("states the hard floor and the expiry in plain language", async () => {
    const account = privateKeyToAccount(KEY);
    const deadline = Date.UTC(2026, 10, 6, 14, 32, 10) / 1000;
    const intent = buildIntent({
      maker: account.address,
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
    const { signature, summary } = await signIntent({
      account,
      intent,
      permit2: PERMIT2,
      settlement: SETTLEMENT,
      chainId: 11155111,
      sellSymbol: "tWETH",
      buySymbol: "tUSDC",
      sellDecimals: 18,
      buyDecimals: 6,
    });

    expect(summary).toBe(
      "Sell 1.0 tWETH. You will receive at least 2,988.0 tUSDC. Tokens leave your wallet only if a solver delivers that amount before 14:32:10 UTC.",
    );
    expect(summary).toContain("2,988.0");
    expect(summary).toContain("14:32:10");
    expect(
      await verifyIntentSignature({
        intent,
        signature,
        permit2: PERMIT2,
        settlement: SETTLEMENT,
        chainId: 11155111,
      }),
    ).toBe(true);
  });
});
