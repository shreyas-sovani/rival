import { buildIntent } from "@rival/intent";
import { stringToHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { getBook, watchIntents } from "./book.ts";
import { PERMIT2, rivalDeployment } from "./deployment.ts";
import { permit2WitnessTypedData } from "./witness.ts";

const HASH = `0x${"ab".repeat(32)}`;
const MAKER = "0x0000000000000000000000000000000000000004";
const OPEN_QUERY =
  "arkiv.schema = str('rival.intent.v1') AND status = str('open') AND pair = str('tWETH/tUSDC') AND deadline > u64(1762401600) ORDER BY deadline:u64 ASC";

function entity(overrides: Record<string, unknown> = {}) {
  return {
    intentHash: HASH,
    maker: MAKER,
    pair: "tWETH/tUSDC",
    amountIn: 10n ** 18n,
    mode: 0,
    gate: 1,
    status: "open",
    deadline: 1_800_000_000n,
    ...overrides,
  };
}

describe("getBook", () => {
  it("sends queryOpenIntents and maps the row that comes back", async () => {
    const query = vi.fn(async () => ({ entities: [entity()], count: 1n }));
    const result = await getBook(
      { pair: "tWETH/tUSDC" },
      { client: { query }, now: 1_762_401_600 },
    );

    expect(query).toHaveBeenCalledWith(OPEN_QUERY, { limit: 100 });
    expect(result.query).toBe(OPEN_QUERY);
    expect(result.count).toBe("1");
    expect(result.rows).toEqual([
      {
        intentHash: HASH,
        maker: MAKER,
        pair: "tWETH/tUSDC",
        amountIn: (10n ** 18n).toString(),
        mode: "0",
        gate: "1",
        status: "open",
        deadline: "1800000000",
        signatureOk: false,
      },
    ]);
  });

  it("keeps a one-sided amount filter off the Arkiv query and applies it to the rows", async () => {
    const other = `0x${"cd".repeat(32)}`;
    const query = vi.fn(async (_text: string) => ({
      entities: [entity(), entity({ intentHash: other, amountIn: 1n })],
    }));
    const result = await getBook(
      { minAmountIn: 10n ** 18n },
      { client: { query }, now: 1_762_401_600 },
    );
    expect(query.mock.calls[0]?.[0]).not.toContain("amountIn");
    expect(result.rows.map((row) => row.intentHash)).toEqual([HASH]);
    expect(result.count).toBe("1");
  });

  it("reads a hex-encoded payload and marks a valid witness signatureOk", async () => {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const deployment = rivalDeployment();
    const intent = buildIntent({
      maker: account.address,
      tokenIn: deployment.tokens.tWETH,
      tokenOut: deployment.tokens.tUSDC,
      amountIn: 10n ** 18n,
      preset: "balanced",
      mode: 0,
      startTime: 1_700_000_000,
      nonce: 4n,
      oracleQuoteOut: 3_000_000_000n,
      baseOut: 3_000_000_000n,
    });
    const typed = permit2WitnessTypedData({
      intent,
      permit2: PERMIT2,
      settlement: deployment.settlement,
      chainId: deployment.chainId,
    });
    const signature = await account.signTypedData({
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
    });
    const wire = {
      ...intent,
      amountIn: intent.amountIn.toString(),
      baseOut: intent.baseOut.toString(),
      hardMinOut: intent.hardMinOut.toString(),
      nonce: intent.nonce.toString(),
    };
    const query = vi.fn(async (_text: string) => ({
      entities: [entity({ payload: { type: "bytes", value: stringToHex(JSON.stringify({ intent: wire, signature })) } })],
    }));
    const result = await getBook({ pair: "tWETH/tUSDC" }, { client: { query }, now: 1_762_401_600 });
    expect(result.rows[0]?.signatureOk).toBe(true);
  });
});

describe("watchIntents", () => {
  it("yields the book row and stops polling when the consumer breaks", async () => {
    const readBook = vi.fn(async () => ({
      query: "q",
      count: "1",
      rows: [
        {
          intentHash: HASH,
          maker: MAKER,
          pair: "tWETH/tUSDC",
          amountIn: "1",
          mode: "0",
          gate: "0",
          status: "open",
          deadline: "10",
          signatureOk: true,
        },
      ],
    }));
    const iter = watchIntents({ pair: "tWETH/tUSDC", status: "open" }, { readBook, intervalMs: 60_000 });
    const first = await iter.next();
    expect(first.done).toBe(false);
    if (first.done) return;
    expect(first.value).toMatchObject({
      intentHash: HASH,
      maker: MAKER,
      pair: "tWETH/tUSDC",
      amountIn: "1",
      deadline: "10",
      status: "open",
      signatureOk: true,
    });
    expect(readBook).toHaveBeenCalledWith({ pair: "tWETH/tUSDC", status: "open" });
    await iter.return(undefined);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(readBook).toHaveBeenCalledTimes(1);
  });
});
