export type SubmitState = "simulate" | "send" | "replace" | "giveUp";

export interface Clock {
  now(): bigint;
}

export interface SubmitSnapshot {
  state: SubmitState;
  fee: bigint;
  deadline: bigint;
}

export interface SubmitSignals {
  /** Simulation succeeded. Read in `simulate`. */
  simOk?: boolean;
  /** Transaction landed. Read in `send` and `replace`. */
  included?: boolean;
}

export interface SubmitStep {
  state: SubmitState;
  fee: bigint;
  reason: string;
}

function bumpFee(fee: bigint): bigint {
  return (fee * 115n) / 100n;
}

/**
 * One step of simulate → send → replace → giveUp.
 * `replace` raises the fee by 15% and only while `now` is before `deadline`.
 * At the deadline every live state becomes `giveUp` and the fee is left unchanged.
 */
export function submitPlan(snapshot: SubmitSnapshot, clock: Clock, signals: SubmitSignals = {}): SubmitStep {
  const { fee, deadline } = snapshot;
  if (snapshot.state === "giveUp") return { state: "giveUp", fee, reason: "given up" };
  if (clock.now() >= deadline) return { state: "giveUp", fee, reason: "deadline" };

  if (snapshot.state === "simulate") {
    if (!signals.simOk) return { state: "simulate", fee, reason: "awaiting simulation" };
    return { state: "send", fee, reason: "simulated" };
  }

  if (snapshot.state === "send") {
    if (signals.included) return { state: "send", fee, reason: "included" };
    return { state: "replace", fee: bumpFee(fee), reason: "replace" };
  }

  if (signals.included) return { state: "replace", fee, reason: "included" };
  return { state: "replace", fee: bumpFee(fee), reason: "replace" };
}
