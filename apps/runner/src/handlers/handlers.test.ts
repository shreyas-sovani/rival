import type { PublishIntentInput } from "@rival/arkiv";
import { buildIntent, hashIntent, permit2TypedData, type BuildIntentInput, type Intent } from "@rival/intent";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCheck, startServices } from "../services/index.ts";
import type { RunnerDeps } from "../services/deps.ts";
import { createHandlers } from "./create.ts";
import { FAUCET_CLAIM_TYPES, faucetClaimTypedData } from "./faucet.ts";
import { MAX_BLOCK_LAG_SEC, MAX_ORACLE_AGE_SEC } from "./health.ts";
import { ApiError, NotImplemented, type ErrorCode, type FaucetRequest, type Handlers, type IntentJson } from "./types.ts";

const CHAIN_ID = 11155111;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const WETH = "0x2222222222222222222222222222222222222222" as const;
const USDC = "0x3333333333333333333333333333333333333333" as const;
const FAUCET = "0x4444444444444444444444444444444444444444" as const;
const PUBLISHER = "0x5555555555555555555555555555555555555555" as const;
const ZERO32 = `0x${"00".repeat(32)}` as const;
const ENTITY = `0x${"bb".repeat(32)}` as const;
const TX = `0x${"aa".repeat(32)}` as const;
const MAKER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const OTHER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as const;
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  MAKER_KEY,
  OTHER_KEY,
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
] as const;
const NOW = 1_700_000_100;
const DAY = Math.floor(NOW / 86_400);

const domain = {
  name: "RivalSettlement",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: SETTLEMENT,
} as const;

const maker = privateKeyToAccount(MAKER_KEY);

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("network is forbidden in runner handler tests");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

interface HarnessPatch {
  limits?: Partial<RunnerDeps["limits"]>;
  probes?: Partial<RunnerDeps["probes"]>;
}

type HarnessOver = Partial<Omit<RunnerDeps, "limits" | "probes">> & HarnessPatch;

interface Harness {
  api: Handlers;
  published: PublishIntentInput[];
  minted: FaucetRequest[];
  relays: number;
  time: { sec: number };
  ip: { value: string };
}

function harness(over: HarnessOver = {}): Harness {
  const time = { sec: NOW };
  const ip = { value: "203.0.113.10" };
  const published: PublishIntentInput[] = [];
  const minted: FaucetRequest[] = [];
  let relays = 0;
  const arkiv = {
    createEntity: async () => {
      throw new Error("arkiv client should be invoked only by the injected publisher");
    },
  };
  const base: RunnerDeps = {
    clock: () => time.sec,
    clientIp: () => ip.value,
    chain: {
      chainId: CHAIN_ID,
      permit2: PERMIT2,
      settlement: SETTLEMENT,
      domain,
      faucet: FAUCET,
      publisher: PUBLISHER,
      tokens: { weth: WETH, usdc: USDC },
    },
    limits: { maxIntentsPerMaker: 5, intentWindowSec: 60, maxTokenClaimsPerIp: 3 },
    nonceUsed: async () => false,
    balanceOf: async () => 10n ** 18n,
    oracleQuote: async () => 3_000_000_000n,
    simulateFill: async () => true,
    arkiv,
    publish: async (client, input) => {
      if (client !== arkiv) throw new Error("publisher was not given the arkiv client");
      published.push(input);
      return ENTITY;
    },
    mint: async (req) => {
      minted.push(req);
      return TX;
    },
    ethRemaining: async () => 10,
    verifyCancel: async () => true,
    relayCancel: async () => {
      relays += 1;
      return TX;
    },
    probes: {
      block: async () => ({ number: "100", lagSec: 1 }),
      oracle: async () => ({ A: { ageSec: 5, obs: 8 }, B: { ageSec: 6, obs: 8 } }),
      bots: async () => ({ house: { ok: true, lastSeenAt: NOW } }),
      house: async () => ({ eth: "100", tWETH: "100", tUSDC: "100" }),
      arkiv: async () => ({ ok: true, latencyMs: 12 }),
      openIntents: async () => 2,
      lastFillAt: async () => null,
    },
  };
  const api = createHandlers({
    ...base,
    ...over,
    chain: over.chain ?? base.chain,
    limits: { ...base.limits, ...over.limits },
    probes: { ...base.probes, ...over.probes },
    arkiv: over.arkiv ?? arkiv,
  });
  return {
    api,
    published,
    minted,
    get relays() {
      return relays;
    },
    time,
    ip,
  };
}

function toJson(intent: Intent): IntentJson {
  return {
    maker: intent.maker,
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amountIn.toString(),
    recipient: intent.recipient,
    mode: intent.mode,
    baseOut: intent.baseOut.toString(),
    oracleWindow: intent.oracleWindow,
    startBps: intent.startBps,
    floorBps: intent.floorBps,
    startTime: intent.startTime,
    decaySecs: intent.decaySecs,
    deadline: intent.deadline,
    hardMinOut: intent.hardMinOut.toString(),
    gate: intent.gate,
    allowlistHash: intent.allowlistHash,
    nonce: intent.nonce.toString(),
  };
}

async function signIntent(over: Partial<BuildIntentInput> = {}, key: Hex = MAKER_KEY, signerKey: Hex = key) {
  const owner = privateKeyToAccount(key);
  const signer = privateKeyToAccount(signerKey);
  const intent = buildIntent({
    tokenIn: WETH,
    tokenOut: USDC,
    amountIn: 10n ** 18n,
    mode: 1,
    startTime: 1_700_000_000,
    nonce: 7n,
    oracleQuoteOut: 3_000_000_000n,
    ...over,
    maker: over.maker ?? owner.address,
  });
  const typed = permit2TypedData({ intent, permit2: PERMIT2, settlement: SETTLEMENT, chainId: CHAIN_ID });
  const signature = await signer.signTypedData({
    domain: typed.domain,
    types: typed.types,
    primaryType: typed.primaryType,
    message: typed.message,
  });
  const json = toJson(intent);
  return {
    intent,
    json,
    signature,
    hash: hashIntent(intent, domain),
    req: { intent: json, signature },
  };
}

function cursor<T>(source: AsyncIterable<T>): AsyncIterator<T> {
  return source[Symbol.asyncIterator]();
}

async function expectCode(work: Promise<unknown>, code: ErrorCode, status: number): Promise<ApiError> {
  try {
    await work;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    const api = error as ApiError;
    expect(api.code).toBe(code);
    expect(api.status).toBe(status);
    return api;
  }
  throw new Error(`expected ${code}`);
}

function wireIntent(over: Partial<IntentJson> = {}): IntentJson {
  return {
    maker: maker.address,
    tokenIn: WETH,
    tokenOut: USDC,
    amountIn: (10n ** 18n).toString(),
    recipient: maker.address,
    mode: 1,
    baseOut: "0",
    oracleWindow: 60,
    startBps: 20,
    floorBps: -30,
    startTime: 1_700_000_000,
    decaySecs: 90,
    deadline: 1_700_000_150,
    hardMinOut: "2955000000",
    gate: 0,
    allowlistHash: ZERO32,
    nonce: "7",
    ...over,
  };
}

describe("health", () => {
  it("is ok only when every probe is healthy and echoes the probe payload", async () => {
    const { api } = harness();
    await expect(api.health({})).resolves.toEqual({
      status: "ok",
      block: { number: "100", lagSec: 1 },
      oracle: { A: { ageSec: 5, obs: 8 }, B: { ageSec: 6, obs: 8 } },
      bots: { house: { ok: true, lastSeenAt: NOW } },
      house: { eth: "100", tWETH: "100", tUSDC: "100" },
      arkiv: { ok: true, latencyMs: 12 },
      openIntents: 2,
      lastFillAt: null,
    });
  });

  it("stays ok at the lag and oracle-age boundaries", async () => {
    const { api } = harness({
      probes: {
        block: async () => ({ number: "100", lagSec: MAX_BLOCK_LAG_SEC }),
        oracle: async () => ({ A: { ageSec: MAX_ORACLE_AGE_SEC, obs: 1 } }),
      },
    });
    await expect(api.health({})).resolves.toMatchObject({ status: "ok" });
  });

  it("degrades on block lag without throwing", async () => {
    const { api } = harness({
      probes: { block: async () => ({ number: "100", lagSec: MAX_BLOCK_LAG_SEC + 1 }) },
    });
    await expect(api.health({})).resolves.toMatchObject({ status: "degraded", block: { lagSec: MAX_BLOCK_LAG_SEC + 1 } });
  });

  it("degrades when pool A or pool B is old", async () => {
    const staleA = harness({
      probes: { oracle: async () => ({ A: { ageSec: MAX_ORACLE_AGE_SEC + 1, obs: 4 } }) },
    });
    await expect(staleA.api.health({})).resolves.toMatchObject({ status: "degraded" });
    const staleB = harness({
      probes: {
        oracle: async () => ({
          A: { ageSec: 1, obs: 4 },
          B: { ageSec: MAX_ORACLE_AGE_SEC + 1, obs: 4 },
        }),
      },
    });
    await expect(staleB.api.health({})).resolves.toMatchObject({ status: "degraded" });
  });

  it("degrades when a bot is down, a house balance is empty, or Arkiv is down", async () => {
    const bot = harness({
      probes: { bots: async () => ({ house: { ok: false, lastSeenAt: NOW }, rival: { ok: true, lastSeenAt: NOW } }) },
    });
    await expect(bot.api.health({})).resolves.toMatchObject({ status: "degraded" });
    const house = harness({
      probes: { house: async () => ({ eth: "1", tWETH: "0", tUSDC: "1" }) },
    });
    await expect(house.api.health({})).resolves.toMatchObject({ status: "degraded" });
    const junk = harness({
      probes: { house: async () => ({ eth: "1", tWETH: "nope", tUSDC: "1" }) },
    });
    await expect(junk.api.health({})).resolves.toMatchObject({ status: "degraded" });
    const arkiv = harness({
      probes: { arkiv: async () => ({ ok: false, latencyMs: 9 }) },
    });
    await expect(arkiv.api.health({})).resolves.toMatchObject({ status: "degraded", arkiv: { ok: false, latencyMs: 9 } });
  });
});

describe("faucet", () => {
  it("defines FaucetClaim over wallet, day, and kind", () => {
    expect(FAUCET_CLAIM_TYPES.FaucetClaim).toEqual([
      { name: "wallet", type: "address" },
      { name: "day", type: "uint256" },
      { name: "kind", type: "string" },
    ]);
    const typed = faucetClaimTypedData({
      wallet: maker.address,
      day: DAY,
      kind: "tokens",
      chainId: CHAIN_ID,
      verifyingContract: FAUCET,
    });
    expect(typed.primaryType).toBe("FaucetClaim");
    expect(typed.domain).toEqual({
      name: "RivalFaucet",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: FAUCET,
    });
    expect(typed.message).toEqual({ wallet: maker.address, day: BigInt(DAY), kind: "tokens" });
  });

  async function claim(accountKey: Hex, kind: "tokens" | "eth" = "tokens"): Promise<FaucetRequest> {
    const account = privateKeyToAccount(accountKey);
    const typed = faucetClaimTypedData({
      wallet: account.address,
      day: DAY,
      kind,
      chainId: CHAIN_ID,
      verifyingContract: FAUCET,
    });
    const signature = await account.signTypedData({
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
    });
    return { wallet: account.address, signature, day: DAY, kind };
  }

  it("returns the injected mint hash and the next UTC day", async () => {
    const { api, minted } = harness();
    const req = await claim(MAKER_KEY);
    await expect(api.faucet(req)).resolves.toEqual({ txHash: TX, nextEligibleAt: (DAY + 1) * 86_400 });
    expect(minted).toEqual([req]);
  });

  it("rejects a signature from a different key", async () => {
    const { api, minted } = harness();
    const req = await claim(MAKER_KEY);
    const forged = await claim(OTHER_KEY);
    const error = await expectCode(api.faucet({ ...req, signature: forged.signature }), "INVALID_SIGNATURE", 400);
    expect(error.message).toMatch(/signature/i);
    expect(minted).toHaveLength(0);
  });

  it("rejects a replay for the same wallet and day", async () => {
    const { api, minted } = harness();
    const req = await claim(MAKER_KEY);
    await api.faucet(req);
    const error = await expectCode(api.faucet(req), "RATE_LIMITED", 429);
    expect(error.message).toMatch(/wallet/i);
    expect(minted).toHaveLength(1);
  });

  it("caps token claims at 3 per IP per day and still allows an ETH drip", async () => {
    const { api, ip, minted } = harness();
    ip.value = "198.51.100.4";
    for (let i = 0; i < 3; i += 1) {
      const key = KEYS[i];
      if (!key) throw new Error("missing key");
      await api.faucet(await claim(key));
    }
    const fourth = KEYS[3];
    if (!fourth) throw new Error("missing key");
    const blocked = await claim(fourth);
    const error = await expectCode(api.faucet(blocked), "RATE_LIMITED", 429);
    expect(error.message).toMatch(/IP/);
    const eth = await claim(fourth, "eth");
    await expect(api.faucet(eth)).resolves.toMatchObject({ txHash: TX });
    expect(minted).toHaveLength(4);
  });

  it("rejects an empty ETH stock without burning the daily claim", async () => {
    let stock = 0;
    const { api, minted } = harness({ ethRemaining: async () => stock });
    const req = await claim(MAKER_KEY, "eth");
    const error = await expectCode(api.faucet(req), "RATE_LIMITED", 429);
    expect(error.message).toMatch(/stock/i);
    expect(minted).toHaveLength(0);
    stock = 1;
    await expect(api.faucet(req)).resolves.toMatchObject({ txHash: TX });
  });

  it("rejects a claim signed for a different UTC day", async () => {
    const { api, minted } = harness();
    const account = privateKeyToAccount(MAKER_KEY);
    const typed = faucetClaimTypedData({
      wallet: account.address,
      day: DAY - 1,
      kind: "tokens",
      chainId: CHAIN_ID,
      verifyingContract: FAUCET,
    });
    const signature = await account.signTypedData({
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
    });
    const error = await expectCode(
      api.faucet({ wallet: account.address, signature, day: DAY - 1, kind: "tokens" }),
      "INVALID_PARAMS",
      400,
    );
    expect(error.message).toMatch(/day/i);
    expect(minted).toHaveLength(0);
  });
});

describe("intents", () => {
  it("publishes a signed intent and returns the recomputed hash", async () => {
    const { api, published } = harness();
    const signed = await signIntent();
    await expect(api.intents(signed.req)).resolves.toEqual({
      intentHash: signed.hash,
      entityKey: ENTITY,
      degraded: false,
    });
    expect(published).toHaveLength(1);
    const input = published[0];
    expect(input?.intent.amountIn).toBe(10n ** 18n);
    expect(input?.intentHash).toBe(signed.hash);
    expect(input?.signature).toBe(signed.signature);
    expect(input?.publisher).toBe(PUBLISHER);
    expect(input?.permit2).toBe(PERMIT2);
    expect(input?.settlement).toBe(SETTLEMENT);
    expect(input?.chainId).toBe(CHAIN_ID);
    expect(input?.pair).toBe("tWETH/tUSDC");
    expect(input?.domain).toEqual(domain);
  });

  it("accepts an absolute intent without reading the oracle", async () => {
    let quotes = 0;
    const { api } = harness({
      oracleQuote: async () => {
        quotes += 1;
        return null;
      },
    });
    const signed = await signIntent({ mode: 0, baseOut: 3_000_000_000n, hardMinOut: 1n, oracleWindow: 0 });
    await expect(api.intents(signed.req)).resolves.toMatchObject({ intentHash: signed.hash, degraded: false });
    expect(quotes).toBe(0);
  });

  it("rejects a forged signature", async () => {
    const { api, published } = harness();
    const signed = await signIntent({}, MAKER_KEY, OTHER_KEY);
    const error = await expectCode(api.intents(signed.req), "INVALID_SIGNATURE", 400);
    expect(error.message).toMatch(/signature/i);
    expect(published).toHaveLength(0);
  });

  it("rejects bad bounds", async () => {
    const { api } = harness();
    const signature = `0x${"11".repeat(65)}` as const;
    const cases: Partial<IntentJson>[] = [
      { startBps: -10, floorBps: 10 },
      { decaySecs: 9 },
      { decaySecs: 3601 },
      { amountIn: "0" },
      { hardMinOut: "0" },
      { amountIn: "nope" },
      { deadline: 1_700_000_000 + 86_401 },
      { startTime: 100, deadline: 50 },
      { tokenIn: FAUCET },
      { tokenOut: WETH },
      { oracleWindow: 59 },
      { startBps: 5001, floorBps: 5000 },
    ];
    for (const patch of cases) {
      await expectCode(api.intents({ intent: wireIntent(patch), signature }), "INVALID_PARAMS", 400);
    }
  });

  it("rejects an expired deadline", async () => {
    const { api, published } = harness();
    const signed = await signIntent({ startTime: NOW - 100, deadline: NOW - 1, decaySecs: 30 });
    const error = await expectCode(api.intents(signed.req), "EXPIRED", 400);
    expect(error.message).toMatch(/deadline/i);
    expect(published).toHaveLength(0);
  });

  it("rejects a used Permit2 nonce", async () => {
    const { api } = harness({ nonceUsed: async () => true });
    const signed = await signIntent();
    await expectCode(api.intents(signed.req), "NONCE_USED", 409);
  });

  it("rejects a maker balance below amountIn and accepts an exact balance", async () => {
    const short = harness({ balanceOf: async () => 10n ** 18n - 1n });
    const signed = await signIntent();
    const error = await expectCode(short.api.intents(signed.req), "INSUFFICIENT_BALANCE", 400);
    expect(error.message).toMatch(/balance/i);
    const exact = harness({ balanceOf: async () => 10n ** 18n });
    await expect(exact.api.intents(signed.req)).resolves.toMatchObject({ degraded: false });
  });

  it("rejects a missing pegged quote", async () => {
    const { api, published } = harness({ oracleQuote: async () => null });
    const signed = await signIntent();
    await expectCode(api.intents(signed.req), "ORACLE_STALE", 503);
    expect(published).toHaveLength(0);
  });

  it("rejects a pegged floor below 98% of the quote", async () => {
    const even = harness({ oracleQuote: async () => 100n });
    await expectCode(even.api.intents((await signIntent({ hardMinOut: 97n, nonce: 1n })).req), "FLOOR_TOO_LOW", 400);
    await expect(even.api.intents((await signIntent({ hardMinOut: 98n, nonce: 2n })).req)).resolves.toMatchObject({
      degraded: false,
    });
    const odd = harness({ oracleQuote: async () => 101n });
    await expectCode(odd.api.intents((await signIntent({ hardMinOut: 98n, nonce: 3n })).req), "FLOOR_TOO_LOW", 400);
    await expect(odd.api.intents((await signIntent({ hardMinOut: 99n, nonce: 4n })).req)).resolves.toMatchObject({
      degraded: false,
    });
  });

  it("rate limits each maker on the injected clock", async () => {
    const { api, time, published } = harness({ limits: { maxIntentsPerMaker: 1, intentWindowSec: 60 } });
    const open = { deadline: NOW + 600, decaySecs: 90 };
    const first = await signIntent({ nonce: 1n, ...open });
    const secondMaker = await signIntent({ nonce: 2n, ...open }, OTHER_KEY);
    await api.intents(first.req);
    const error = await expectCode(api.intents(first.req), "RATE_LIMITED", 429);
    expect(error.message).toMatch(/maker/i);
    await expect(api.intents(secondMaker.req)).resolves.toMatchObject({ degraded: false });
    time.sec = NOW + 60;
    await expect(api.intents(first.req)).resolves.toMatchObject({ degraded: false });
    expect(published).toHaveLength(3);
  });

  it("rejects an intent the house fill simulation refuses", async () => {
    const { api, published } = harness({ simulateFill: async () => false });
    const signed = await signIntent();
    const error = await expectCode(api.intents(signed.req), "INVALID_PARAMS", 400);
    expect(error.message).toMatch(/simulation/i);
    expect(published).toHaveLength(0);
  });

  it("parks a failed Arkiv write on the degraded feed instead of throwing", async () => {
    const { api } = harness({
      publish: async () => {
        throw new ApiError("ARKIV_UNAVAILABLE", "arkiv down");
      },
    });
    const signed = await signIntent();
    await expect(api.intents(signed.req)).resolves.toEqual({ intentHash: signed.hash, degraded: true });
    const ac = new AbortController();
    const iter = cursor(await api.stream({ signal: ac.signal }));
    const first = await iter.next();
    expect(first.value).toEqual({
      intentHash: signed.hash,
      intent: signed.json,
      signature: signed.signature,
      degraded: true,
    });
    ac.abort();
    await expect(iter.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it("wakes a stream that is already open when Arkiv fails", async () => {
    const { api } = harness({
      publish: async () => {
        throw new Error("arkiv down");
      },
    });
    const ac = new AbortController();
    const iter = cursor(await api.stream({ signal: ac.signal }));
    const pending = iter.next();
    const signed = await signIntent({ nonce: 9n });
    await api.intents(signed.req);
    await expect(pending).resolves.toMatchObject({
      done: false,
      value: { intentHash: signed.hash, degraded: true, signature: signed.signature },
    });
    ac.abort();
    await iter.next();
  });

  it("does not stream an intent Arkiv accepted", async () => {
    const { api } = harness();
    await api.intents((await signIntent()).req);
    const ac = new AbortController();
    const iter = cursor(await api.stream({ signal: ac.signal }));
    const pending = iter.next();
    ac.abort();
    await expect(pending).resolves.toEqual({ value: undefined, done: true });
  });
});

describe("cancel", () => {
  const intentHash = ZERO32;
  const signature = `0x${"22".repeat(65)}` as const;

  it("returns the injected relayer hash", async () => {
    const box = harness();
    await expect(box.api.cancel({ intentHash, deadline: NOW + 60, signature })).resolves.toEqual({ txHash: TX });
    expect(box.relays).toBe(1);
  });

  it("rejects a bad cancel signature and does not relay", async () => {
    const box = harness({ verifyCancel: async () => false });
    const error = await expectCode(
      box.api.cancel({ intentHash, deadline: NOW + 60, signature }),
      "INVALID_SIGNATURE",
      400,
    );
    expect(error.message).toMatch(/signature/i);
    expect(box.relays).toBe(0);
  });
});

describe("stream", () => {
  it("ends immediately when the signal is already aborted", async () => {
    const { api } = harness();
    const ac = new AbortController();
    ac.abort();
    const iter = cursor(await api.stream({ signal: ac.signal }));
    await expect(iter.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it("stops waiting when the signal aborts", async () => {
    const { api } = harness();
    const ac = new AbortController();
    const iter = cursor(await api.stream({ signal: ac.signal }));
    const pending = iter.next();
    ac.abort();
    await expect(pending).resolves.toEqual({ value: undefined, done: true });
  });
});

describe("service stubs", () => {
  it("leaves boot and the Sepolia check on M-022", async () => {
    await expect(startServices()).rejects.toBeInstanceOf(NotImplemented);
    await expect(runCheck()).rejects.toMatchObject({ message: "NOT_IMPLEMENTED(M-022)" });
  });
});
