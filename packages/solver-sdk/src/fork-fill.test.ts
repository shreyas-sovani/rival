import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import recorded from "./fixtures/sepolia-quoter.json" with { type: "json" };
import type { FillPlan, RunSolverPorts, StrategyId } from "./run.ts";
import { runSolver } from "./run.ts";
import { arb, house, inventory, patient, sprint, type StrategyInput } from "./strategies.ts";
import type { Address, Hex, Intent } from "./types.ts";
import { permit2WitnessDigest } from "./witness.ts";

const QUOTE_A = BigInt(recorded.pools.A.amountOut);
const QUOTE_B = BigInt(recorded.pools.B.amountOut);
const AMOUNT_IN = BigInt(recorded.amountIn);
const TOKEN_IN = recorded.tokenIn as Address;
const TOKEN_OUT = recorded.tokenOut as Address;
const DECAY = 100n;
const HALFWAY = DECAY / 2n;
const CHAIN_ID = recorded.chainId;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;
const START = 1_700_000_000n;

const account = privateKeyToAccount(generatePrivateKey());

function curveInput(overrides: Partial<StrategyInput> = {}): StrategyInput {
  return {
    elapsed: 0n,
    decaySecs: DECAY,
    startBps: 0n,
    floorBps: 0n,
    quoteOut: QUOTE_A,
    costOut: 0n,
    hardMinOut: QUOTE_A,
    ...overrides,
  };
}

function seededIntent(): Intent {
  return {
    maker: account.address,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: AMOUNT_IN,
    recipient: account.address,
    mode: 0,
    baseOut: 0n,
    oracleWindow: 0,
    startBps: 0,
    floorBps: 0,
    startTime: Number(START),
    decaySecs: Number(DECAY),
    deadline: Number(START + DECAY),
    hardMinOut: QUOTE_A,
    gate: 0,
    allowlistHash: ZERO_BYTES32,
    nonce: 1n,
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

async function seededDecision(opts: {
  strategy: StrategyId;
  now: bigint;
  balanceOut?: bigint;
  othersPassing?: boolean;
  costOut?: bigint;
}) {
  const value = seededIntent();
  const digest = permit2WitnessDigest({
    intent: value,
    permit2: PERMIT2,
    settlement: SETTLEMENT,
    chainId: CHAIN_ID,
  });
  const submitted: FillPlan[] = [];
  const quoted: { venue: "hooked" | "other"; amountIn: bigint }[] = [];
  const ports: RunSolverPorts = {
    book: {
      listOpen: async () => [
        { intentJson: intentJson(value), signature: await account.sign({ hash: digest }) },
      ],
    },
    quoter: {
      quoteExactInput: async (args) => {
        quoted.push({ venue: args.venue, amountIn: args.amountIn });
        if (args.tokenIn !== TOKEN_IN || args.tokenOut !== TOKEN_OUT || args.amountIn !== AMOUNT_IN) {
          throw new Error("quote args do not match the seeded intent");
        }
        return args.venue === "hooked" ? QUOTE_A : QUOTE_B;
      },
    },
    submitter: {
      balanceOf: async () => AMOUNT_IN,
      nonceUsed: async () => false,
      submit: async (plan) => {
        submitted.push(plan);
      },
    },
    clock: { now: () => opts.now },
    presence: {
      lastExtend: async () => opts.now,
      extend: async () => {
        throw new Error("presence write is outside this fixture");
      },
    },
    strategy: opts.strategy,
    chainId: CHAIN_ID,
    settlement: SETTLEMENT,
    permit2: PERMIT2,
    balanceOut: opts.balanceOut,
    othersPassing: opts.othersPassing,
    costOut: opts.costOut,
  };
  const result = await runSolver(ports);
  return { result, submitted, quoted };
}

describe("recorded Sepolia quoter", () => {
  it("keeps the eth_call amounts from block 12075841", () => {
    expect(recorded.quoter).toBe("0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244");
    expect(recorded.blockNumber).toBe("12075841");
    expect(recorded.blockHash).toBe("0x78c749e264132720eb8ec807288f7b78b4dd761e91962e3fde88f5b9b02be434");
    expect(QUOTE_A).toBe(2_998_350_157n);
    expect(QUOTE_B).toBe(2_990_850_906n);
    expect(recorded.pools.A.gasEstimate).toBe("87153");
    expect(recorded.pools.B.gasEstimate).toBe("50929");
    expect(QUOTE_B < QUOTE_A).toBe(true);
  });
});

describe("strategies at the recorded quote", () => {
  it("sprint fills early, while patient is still waiting", () => {
    const early = curveInput({ elapsed: 0n });
    expect(sprint(early)).toEqual({ fill: true, reason: "covers required" });
    expect(patient(early)).toEqual({ fill: false, reason: "waiting" });
  });

  it("patient fills at halfway and after, and not one second before", () => {
    expect(patient(curveInput({ elapsed: HALFWAY - 1n }))).toEqual({ fill: false, reason: "waiting" });
    expect(patient(curveInput({ elapsed: HALFWAY }))).toEqual({ fill: true, reason: "halfway" });
    expect(patient(curveInput({ elapsed: DECAY }))).toEqual({ fill: true, reason: "halfway" });
  });

  it("arb fills only when pool B beats pool A by more than cost", () => {
    const gap = QUOTE_B - QUOTE_A;
    expect(gap).toBe(-7_499_251n);
    expect(arb(curveInput({ otherQuoteOut: QUOTE_B, costOut: 0n }))).toEqual({
      fill: false,
      reason: "gap within cost",
    });
    expect(arb(curveInput({ otherQuoteOut: QUOTE_B, costOut: QUOTE_A - QUOTE_B }))).toEqual({
      fill: false,
      reason: "gap within cost",
    });
  });

  it("inventory fills only when the balance covers required", () => {
    expect(inventory(curveInput({ balanceOut: QUOTE_A }))).toEqual({
      fill: true,
      reason: "balance covers required",
    });
    expect(inventory(curveInput({ balanceOut: QUOTE_A - 1n }))).toEqual({
      fill: false,
      reason: "insufficient inventory",
    });
  });

  it("house fills when nobody else would and the quote clears the hard floor", () => {
    expect(house(curveInput({ othersPassing: false }))).toEqual({ fill: true, reason: "house fills" });
    expect(house(curveInput({ othersPassing: true }))).toEqual({ fill: false, reason: "others passing" });
    expect(house(curveInput({ othersPassing: false, hardMinOut: QUOTE_A + 1n }))).toEqual({
      fill: false,
      reason: "below hard minimum",
    });
  });
});

describe("seeded intent decisions", () => {
  it("submits sprint, patient, inventory, and house at their points and does not submit arb", async () => {
    const sprintFill = await seededDecision({ strategy: "sprint", now: START });
    expect(sprintFill.quoted).toEqual([{ venue: "hooked", amountIn: AMOUNT_IN }]);
    expect(sprintFill.submitted).toEqual([
      expect.objectContaining({ strategy: "sprint", reason: "covers required", quoteOut: QUOTE_A }),
    ]);

    const patientEarly = await seededDecision({ strategy: "patient", now: START });
    expect(patientEarly.submitted).toHaveLength(0);

    const patientHalfway = await seededDecision({ strategy: "patient", now: START + HALFWAY });
    expect(patientHalfway.submitted).toEqual([
      expect.objectContaining({ strategy: "patient", reason: "halfway", quoteOut: QUOTE_A }),
    ]);

    const arbFill = await seededDecision({ strategy: "arb", now: START, costOut: 0n });
    expect(arbFill.quoted).toEqual([
      { venue: "hooked", amountIn: AMOUNT_IN },
      { venue: "other", amountIn: AMOUNT_IN },
    ]);
    expect(arbFill.submitted).toHaveLength(0);
    expect(arbFill.result.submitted).toBeNull();

    const covered = await seededDecision({ strategy: "inventory", now: START, balanceOut: QUOTE_A });
    expect(covered.submitted).toEqual([
      expect.objectContaining({ strategy: "inventory", reason: "balance covers required", quoteOut: QUOTE_A }),
    ]);
    const short = await seededDecision({ strategy: "inventory", now: START, balanceOut: QUOTE_A - 1n });
    expect(short.submitted).toHaveLength(0);

    const houseFill = await seededDecision({ strategy: "house", now: START, othersPassing: false });
    expect(houseFill.submitted).toEqual([
      expect.objectContaining({ strategy: "house", reason: "house fills", quoteOut: QUOTE_A }),
    ]);
    const crowded = await seededDecision({ strategy: "house", now: START, othersPassing: true });
    expect(crowded.submitted).toHaveLength(0);
  });
});
