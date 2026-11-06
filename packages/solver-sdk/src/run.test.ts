import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { runSolver, type FillPlan, type RunSolverPorts, type StrategyId } from "./run.ts";
import type { Hex, Intent } from "./types.ts";
import { permit2WitnessDigest } from "./witness.ts";

const CHAIN_ID = 11155111;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const TOKEN_IN = "0x2222222222222222222222222222222222222222" as const;
const TOKEN_OUT = "0x3333333333333333333333333333333333333333" as const;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;
const START = 1_700_000_000n;
const QUOTE = 100_000n;

const account = privateKeyToAccount(generatePrivateKey());

function intent(overrides: Partial<Intent> = {}): Intent {
  return {
    maker: account.address,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: 1_000n,
    recipient: account.address,
    mode: 0,
    baseOut: 0n,
    oracleWindow: 0,
    startBps: 0,
    floorBps: -5,
    startTime: Number(START),
    decaySecs: 100,
    deadline: Number(START) + 100,
    hardMinOut: 1n,
    gate: 0,
    allowlistHash: ZERO_BYTES32,
    nonce: 1n,
    ...overrides,
  };
}

function intentJson(value: Intent): string {
  return JSON.stringify({
    ...value,
    amountIn: value.amountIn.toString(),
    baseOut: value.baseOut.toString(),
    hardMinOut: value.hardMinOut.toString(),
    nonce: value.nonce.toString(),
  });
}

async function signedRow(value: Intent, signature?: Hex) {
  const digest = permit2WitnessDigest({
    intent: value,
    permit2: PERMIT2,
    settlement: SETTLEMENT,
    chainId: CHAIN_ID,
  });
  return {
    intentJson: intentJson(value),
    signature: signature ?? (await account.sign({ hash: digest })),
  };
}

async function iterate(opts: {
  strategy: StrategyId;
  now: bigint;
  intents: Intent[];
  quoteOut?: bigint;
  balance?: bigint;
  nonceUsed?: boolean;
  lastExtend?: bigint;
  signatures?: (Hex | undefined)[];
}) {
  const submitted: FillPlan[] = [];
  const extendedAt: bigint[] = [];
  const rows: { intentJson: string; signature: Hex }[] = [];
  for (let i = 0; i < opts.intents.length; i += 1) {
    const item = opts.intents[i];
    if (!item) continue;
    rows.push(await signedRow(item, opts.signatures?.[i]));
  }
  const ports: RunSolverPorts = {
    book: { listOpen: async () => rows },
    quoter: {
      quoteExactInput: async () => opts.quoteOut ?? QUOTE,
    },
    submitter: {
      balanceOf: async () => opts.balance ?? 1_000n,
      nonceUsed: async () => opts.nonceUsed ?? false,
      submit: async (plan) => {
        submitted.push(plan);
      },
    },
    clock: { now: () => opts.now },
    presence: {
      lastExtend: async () => opts.lastExtend ?? opts.now,
      extend: async (at) => {
        extendedAt.push(at);
      },
    },
    strategy: opts.strategy,
    chainId: CHAIN_ID,
    settlement: SETTLEMENT,
    permit2: PERMIT2,
  };
  const result = await runSolver(ports);
  return { result, submitted, extendedAt };
}

describe("runSolver", () => {
  it("sprint submits when the quote clears the curve and stops after one fill", async () => {
    const first = intent();
    const second = intent({ nonce: 2n });
    const { result, submitted, extendedAt } = await iterate({
      strategy: "sprint",
      now: START,
      intents: [first, second],
      lastExtend: START - 60n,
    });

    expect(submitted).toHaveLength(1);
    expect(result.submitted).toMatchObject({
      strategy: "sprint",
      reason: "covers required",
      quoteOut: QUOTE,
    });
    expect(result.submitted?.intent.nonce).toBe(1n);
    expect(result.presenceExtended).toBe(true);
    expect(extendedAt).toEqual([START]);

    const below = await iterate({
      strategy: "sprint",
      now: START,
      intents: [intent({ startBps: 50 })],
    });
    expect(below.submitted).toHaveLength(0);
    expect(below.result.submitted).toBeNull();
  });

  it("patient does not submit before halfway unless the quote clears the floor", async () => {
    const waiting = intent();
    const early = await iterate({ strategy: "patient", now: START, intents: [waiting] });
    expect(early.submitted).toHaveLength(0);

    const sprintInstead = await iterate({ strategy: "sprint", now: START, intents: [waiting] });
    expect(sprintInstead.submitted).toHaveLength(1);
    expect(sprintInstead.result.submitted?.reason).toBe("covers required");

    const clearsFloor = await iterate({
      strategy: "patient",
      now: START,
      intents: [intent({ floorBps: -30 })],
    });
    expect(clearsFloor.submitted).toHaveLength(1);
    expect(clearsFloor.result.submitted?.reason).toBe("clears floor");

    const halfway = await iterate({ strategy: "patient", now: START + 50n, intents: [waiting] });
    expect(halfway.submitted).toHaveLength(1);
    expect(halfway.result.submitted?.reason).toBe("halfway");

    const short = await iterate({
      strategy: "patient",
      now: START + 50n,
      intents: [intent({ startBps: 50 })],
    });
    expect(short.submitted).toHaveLength(0);
  });

  it("skips a forged signature, a drained balance, and a used nonce", async () => {
    const open = intent();
    const forged = await iterate({
      strategy: "sprint",
      now: START,
      intents: [open],
      signatures: [`0x${"11".repeat(65)}` as Hex],
    });
    expect(forged.submitted).toHaveLength(0);

    const drained = await iterate({
      strategy: "sprint",
      now: START,
      intents: [open],
      balance: open.amountIn - 1n,
    });
    expect(drained.submitted).toHaveLength(0);

    const used = await iterate({
      strategy: "sprint",
      now: START,
      intents: [open],
      nonceUsed: true,
    });
    expect(used.submitted).toHaveLength(0);
  });
});
