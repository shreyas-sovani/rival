import { ExpirationTime } from "@arkiv-network/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { buildIntent, permit2TypedData } from "../../intent/src/index.ts";
import type { Hex } from "../../intent/src/types.ts";
import { hashIntent } from "../../intent/src/eip712.ts";
import { patchStatus, publishIntent, queryOpenIntents, upsertPresence, countPresence } from "./book.ts";
import { encodeIntentPayload, verifyPayload, type IntentWitnessContext } from "./payload.ts";
import { IntentEntity, SolverPresence } from "./schemas.ts";

const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const account = privateKeyToAccount(KEY);
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const TOKEN_IN = "0x2222222222222222222222222222222222222222" as const;
const TOKEN_OUT = "0x3333333333333333333333333333333333333333" as const;
const ENTITY = `0x${"ab".repeat(32)}` as Hex;

const domain = {
  name: "RivalSettlement",
  version: "1",
  chainId: 11155111,
  verifyingContract: SETTLEMENT,
} as const;

const context: IntentWitnessContext = {
  domain,
  permit2: PERMIT2,
  settlement: SETTLEMENT,
  chainId: 11155111,
};

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
    allowLabels: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    floorBps: -30,
  });
}

async function signed() {
  const intent = sample();
  const typed = permit2TypedData({ intent, permit2: PERMIT2, settlement: SETTLEMENT, chainId: 11155111 });
  const signature = await account.signTypedData({
    domain: typed.domain,
    types: typed.types,
    primaryType: typed.primaryType,
    message: typed.message,
  });
  return { intent, signature, intentHash: hashIntent(intent, domain) };
}

describe("verifyPayload", () => {
  it("accepts a valid signature and rejects a forged one", async () => {
    const { intent, signature, intentHash } = await signed();
    const payload = encodeIntentPayload({ intent, signature });
    const verified = await verifyPayload(payload, context);
    expect(verified.intentHash).toBe(intentHash);
    expect(verified.intent.maker).toBe(account.address);

    const body = signature.slice(2);
    const forged = `0x${body.slice(0, 10)}${body[10] === "a" ? "b" : "a"}${body.slice(11)}` as Hex;
    const bad = encodeIntentPayload({ intent, signature: forged });
    await expect(verifyPayload(bad, context)).rejects.toThrow(/signature/);
  });

  it("rejects a payload whose claimed hash does not match", async () => {
    const { intent, signature } = await signed();
    const encoded = JSON.parse(new TextDecoder().decode(encodeIntentPayload({ intent, signature }))) as {
      intent: unknown;
      signature: string;
      intentHash?: string;
    };
    encoded.intentHash = `0x${"11".repeat(32)}`;
    await expect(verifyPayload(JSON.stringify(encoded), context)).rejects.toThrow(/hash/);
  });
});

describe("publishIntent", () => {
  it("rejects a payload larger than 2048 bytes", async () => {
    const { intent, signature } = await signed();
    const createEntity = vi.fn();
    await expect(
      publishIntent({ createEntity } as never, {
        ...context,
        intent,
        signature,
        publisher: account.address,
        payload: new Uint8Array(2049),
      }),
    ).rejects.toThrow(/2048/);
    expect(createEntity).not.toHaveBeenCalled();
  });

  it("creates an open intent that expires five minutes after the deadline", async () => {
    const { intent, signature, intentHash } = await signed();
    const createEntity = vi.fn(async () => ({ entityKey: ENTITY, txHash: ENTITY, expiresAt: 1n }));
    const key = await publishIntent({ createEntity } as never, {
      ...context,
      intent,
      signature,
      publisher: account.address,
      pair: "tWETH/tUSDC",
    });
    expect(key).toBe(ENTITY);
    expect(createEntity).toHaveBeenCalledOnce();
    const call = createEntity.mock.calls[0] as unknown as [
      unknown,
      { status: string; intentHash: string; payload: Uint8Array },
      { expiration: { expiresAt: Date; minLifetime: bigint } },
    ];
    const [schema, values, options] = call;
    expect(schema).toBe(IntentEntity);
    expect(values.status).toBe("open");
    expect(values.intentHash).toBe(intentHash);
    expect(values.payload.byteLength).toBeLessThanOrEqual(2048);
    expect(options.expiration.expiresAt).toEqual(new Date((intent.deadline + 5 * 60) * 1000));
    expect(options.expiration.minLifetime).toBe(0n);
    expect(options.expiration).toEqual(ExpirationTime.atDate(new Date((intent.deadline + 5 * 60) * 1000)));
  });
});

describe("queryOpenIntents", () => {
  it("sends the canonical open query and caps the page at 100", async () => {
    const query = vi.fn(async () => ({ entities: [], blockNumber: 1n, count: undefined }));
    await queryOpenIntents({
      client: { query } as never,
      now: 1_762_401_600,
      status: "open",
      pair: "tWETH/tUSDC",
      sortDeadlineAsc: true,
    });
    expect(query).toHaveBeenCalledWith(
      "arkiv.schema = str('rival.intent.v1') AND status = str('open') AND pair = str('tWETH/tUSDC') AND deadline > u64(1762401600) ORDER BY deadline:u64 ASC",
      { limit: 100 },
    );
    await expect(
      queryOpenIntents({
        client: { query } as never,
        now: 1_762_401_600,
        pair: "tWETH/tUSDC",
        limit: 101,
      }),
    ).rejects.toThrow(/100/);
  });
});

describe("countPresence", () => {
  it("uses the count projection for the pair", async () => {
    const fetch = vi.fn(async () => 4n);
    const where = vi.fn(() => ({ fetch }));
    const from = vi.fn(() => ({ where }));
    const count = vi.fn(() => ({ from }));
    await expect(countPresence({ count } as never, "tWETH/tUSDC")).resolves.toBe(4n);
    expect(from).toHaveBeenCalledWith(SolverPresence);
    const whereArgs = where.mock.calls[0] as unknown as [unknown];
    expect(String(whereArgs[0])).toBe("pair = str('tWETH/tUSDC')");
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("upsertPresence", () => {
  const presence = {
    solver: account.address,
    ensName: "atlas.solvers.rival.eth",
    pair: "tWETH/tUSDC",
    maxAmountIn: 10n ** 18n,
    strategy: "sprint",
    version: "0.0.0",
  };

  it("extends when a key is passed and creates when it is not", async () => {
    const extendEntity = vi.fn(async () => ({ entityKey: ENTITY, txHash: ENTITY, expiresAt: 9n }));
    const createEntity = vi.fn(async () => ({ entityKey: ENTITY, txHash: ENTITY, expiresAt: 9n }));
    const client = { extendEntity, createEntity };

    await upsertPresence(client as never, { ...presence, entityKey: ENTITY });
    expect(extendEntity).toHaveBeenCalledOnce();
    expect(createEntity).not.toHaveBeenCalled();
    const extension = (extendEntity.mock.calls[0] as unknown as [{ entityKey: Hex; expiration: { minLifetime: bigint } }])[0];
    expect(extension.entityKey).toBe(ENTITY);
    expect(extension.expiration).toEqual(ExpirationTime.fromMinutes(3));

    await upsertPresence(client as never, presence);
    expect(createEntity).toHaveBeenCalledOnce();
    const [schema, , options] = createEntity.mock.calls[0] as unknown as [unknown, unknown, { expiration: unknown }];
    expect(schema).toBe(SolverPresence);
    expect(options.expiration).toEqual(ExpirationTime.fromMinutes(3));
  });
});

describe("patchStatus", () => {
  it("sends filled and cancelled", async () => {
    const patchEntity = vi.fn(async (_schema: unknown, entityKey: Hex) => ({ entityKey, txHash: entityKey }));
    const filledBy = "0x4444444444444444444444444444444444444444" as const;
    await patchStatus({ patchEntity } as never, ENTITY, {
      status: "filled",
      filledBy,
      fillTx: "0xabc",
    });
    await patchStatus({ patchEntity } as never, ENTITY, { status: "cancelled" });
    expect(patchEntity).toHaveBeenNthCalledWith(1, IntentEntity, ENTITY, {
      set: expect.objectContaining({ status: "filled", fillTx: "0xabc" }),
    });
    const filledSet = (patchEntity.mock.calls[0] as unknown as [unknown, Hex, { set: { filledBy: { value: string }; status: string } }])[2];
    expect(filledSet.set.status).toBe("filled");
    expect(filledSet.set.filledBy.value.toLowerCase()).toBe(filledBy.toLowerCase());
    expect(patchEntity).toHaveBeenNthCalledWith(2, IntentEntity, ENTITY, {
      set: { status: "cancelled" },
    });
  });
});
