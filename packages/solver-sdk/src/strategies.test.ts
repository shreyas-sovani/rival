import { describe, expect, it } from "vitest";
import { arb, house, inventory, patient, sprint, type StrategyInput } from "./strategies.ts";

function input(overrides: Partial<StrategyInput> = {}): StrategyInput {
  return {
    elapsed: 0n,
    decaySecs: 100n,
    startBps: 0n,
    floorBps: -5n,
    quoteOut: 100_000n,
    costOut: 0n,
    hardMinOut: 1n,
    ...overrides,
  };
}

describe("strategies", () => {
  it("sprint fills as soon as the quote covers required", () => {
    expect(sprint(input())).toEqual({ fill: true, reason: "covers required" });
    expect(sprint(input({ startBps: 50n }))).toEqual({ fill: false, reason: "below required" });
  });

  it("patient waits for halfway unless the quote clears the floor by 10 bps", () => {
    const waiting = input();
    expect(patient(waiting)).toEqual({ fill: false, reason: "waiting" });
    expect(sprint(waiting).fill).toBe(true);

    expect(patient(input({ floorBps: -30n }))).toEqual({ fill: true, reason: "clears floor" });
    expect(patient(input({ elapsed: 50n }))).toEqual({ fill: true, reason: "halfway" });
    expect(patient(input({ startBps: 50n, elapsed: 50n }))).toEqual({ fill: false, reason: "below required" });
  });

  it("arb fills only when the other venue beats the hooked quote by more than cost", () => {
    const shared = input({ quoteOut: 1_000n, costOut: 25n });
    expect(arb({ ...shared, otherQuoteOut: 1_026n })).toEqual({ fill: true, reason: "venue covers cost" });
    expect(arb({ ...shared, otherQuoteOut: 1_025n })).toEqual({ fill: false, reason: "gap within cost" });
    expect(arb({ ...shared, otherQuoteOut: 1_024n })).toEqual({ fill: false, reason: "gap within cost" });
  });

  it("inventory fills only when the tokenOut balance covers required", () => {
    expect(inventory(input({ balanceOut: 100_000n }))).toEqual({ fill: true, reason: "balance covers required" });
    expect(inventory(input({ balanceOut: 99_999n }))).toEqual({ fill: false, reason: "insufficient inventory" });
  });

  it("house fills at the hard floor only when nobody else would", () => {
    const atFloor = input({ quoteOut: 500n, hardMinOut: 500n });
    expect(house({ ...atFloor, othersPassing: false })).toEqual({ fill: true, reason: "house fills" });
    expect(house({ ...atFloor, othersPassing: true })).toEqual({ fill: false, reason: "others passing" });
    expect(house({ ...atFloor, quoteOut: 499n, othersPassing: false })).toEqual({
      fill: false,
      reason: "below hard minimum",
    });
  });
});
