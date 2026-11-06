import { describe, expect, it } from "vitest";
import { submitPlan, type Clock, type SubmitSnapshot } from "./submit.ts";

describe("submitPlan", () => {
  it("walks simulate → send → replace, then gives up at the deadline without another bump", () => {
    let now = 1_000n;
    const clock: Clock = { now: () => now };
    const deadline = 2_000n;

    const simulated = submitPlan({ state: "simulate", fee: 2_000n, deadline }, clock, { simOk: false });
    expect(simulated).toEqual({ state: "simulate", fee: 2_000n, reason: "awaiting simulation" });

    const sent = submitPlan({ state: "simulate", fee: 2_000n, deadline }, clock, { simOk: true });
    expect(sent).toEqual({ state: "send", fee: 2_000n, reason: "simulated" });

    const replaced = submitPlan({ state: "send", fee: sent.fee, deadline }, clock, { included: false });
    expect(replaced).toEqual({ state: "replace", fee: 2_300n, reason: "replace" });

    const bumped = submitPlan({ state: "replace", fee: replaced.fee, deadline }, clock, { included: false });
    expect(bumped).toEqual({ state: "replace", fee: 2_645n, reason: "replace" });

    now = deadline;
    const givenUp = submitPlan({ state: "replace", fee: bumped.fee, deadline }, clock, { included: false });
    expect(givenUp).toEqual({ state: "giveUp", fee: 2_645n, reason: "deadline" });
    expect(submitPlan({ state: "giveUp", fee: givenUp.fee, deadline }, clock)).toEqual({
      state: "giveUp",
      fee: 2_645n,
      reason: "given up",
    });
  });

  it("does not replace once the transaction is included or the deadline has arrived", () => {
    const clock: Clock = { now: () => 1_500n };
    const pending: SubmitSnapshot = { state: "send", fee: 2_000n, deadline: 1_500n };
    expect(submitPlan(pending, clock, { included: false })).toEqual({
      state: "giveUp",
      fee: 2_000n,
      reason: "deadline",
    });

    const live: SubmitSnapshot = { state: "send", fee: 2_000n, deadline: 1_501n };
    expect(submitPlan(live, clock, { included: true })).toEqual({
      state: "send",
      fee: 2_000n,
      reason: "included",
    });
  });
});
