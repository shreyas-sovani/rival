import { ceilDiv, outputCurve } from "./curve.ts";

const BPS_DENOM = 10_000n;
const TEN_BPS = 10_010n;

export interface StrategyInput {
  elapsed: bigint;
  decaySecs: bigint;
  startBps: bigint;
  floorBps: bigint;
  /** Hooked-venue quote, also the curve base. */
  quoteOut: bigint;
  costOut: bigint;
  hardMinOut: bigint;
  /** Second venue quote. Required by `arb`. */
  otherQuoteOut?: bigint;
  /** Solver tokenOut balance. Required by `inventory`. */
  balanceOut?: bigint;
  /** True when another solver would fill. Required by `house`. */
  othersPassing?: boolean;
}

export interface StrategyDecision {
  fill: boolean;
  reason: string;
}

const no = (reason: string): StrategyDecision => ({ fill: false, reason });
const yes = (reason: string): StrategyDecision => ({ fill: true, reason });

function curveRequired(input: StrategyInput): bigint | null {
  if (input.decaySecs <= 0n || input.quoteOut < 0n || input.hardMinOut < 0n) return null;
  return outputCurve({
    now: input.elapsed,
    start: 0n,
    decaySecs: input.decaySecs,
    startBps: input.startBps,
    floorBps: input.floorBps,
    base: input.quoteOut,
    hardMinOut: input.hardMinOut,
  }).required;
}

/** Output at `floorBps`, still bounded by `hardMinOut`. */
function floorOut(input: StrategyInput): bigint {
  const curveOut = ceilDiv(input.quoteOut * (BPS_DENOM + input.floorBps), BPS_DENOM);
  return curveOut > input.hardMinOut ? curveOut : input.hardMinOut;
}

/** Quote is at least 10 bps above the floor output. */
function clearsFloorBy10Bps(input: StrategyInput): boolean {
  const floor = floorOut(input);
  return input.quoteOut * BPS_DENOM >= floor * TEN_BPS;
}

/** Fills the first moment the hooked quote covers the curve. */
export function sprint(input: StrategyInput): StrategyDecision {
  const required = curveRequired(input);
  if (required === null) return no("bad params");
  if (input.quoteOut >= required) return yes("covers required");
  return no("below required");
}

/**
 * Waits until the curve is at least halfway through `decaySecs`.
 * Fills earlier when the quote already clears the floor output by 10 bps.
 * Either path still requires the quote to cover `required`.
 */
export function patient(input: StrategyInput): StrategyDecision {
  const required = curveRequired(input);
  if (required === null) return no("bad params");
  if (input.quoteOut < required) return no("below required");
  let elapsed = input.elapsed;
  if (elapsed < 0n) elapsed = 0n;
  if (elapsed > input.decaySecs) elapsed = input.decaySecs;
  if (elapsed * 2n >= input.decaySecs) return yes("halfway");
  if (clearsFloorBy10Bps(input)) return yes("clears floor");
  return no("waiting");
}

/** Fills only when the second venue beats the hooked quote by strictly more than `costOut`. */
export function arb(input: StrategyInput): StrategyDecision {
  if (input.otherQuoteOut === undefined || input.costOut < 0n) return no("bad params");
  if (input.otherQuoteOut - input.quoteOut > input.costOut) return yes("venue covers cost");
  return no("gap within cost");
}

/** Fills only when the solver's tokenOut balance covers the curve requirement. */
export function inventory(input: StrategyInput): StrategyDecision {
  const required = curveRequired(input);
  if (required === null || input.balanceOut === undefined) return no("bad params");
  if (input.balanceOut >= required) return yes("balance covers required");
  return no("insufficient inventory");
}

/** Fills when the quote clears the hard floor and no other solver would. */
export function house(input: StrategyInput): StrategyDecision {
  if (typeof input.othersPassing !== "boolean" || input.quoteOut < 0n || input.hardMinOut < 0n) {
    return no("bad params");
  }
  if (input.quoteOut < input.hardMinOut) return no("below hard minimum");
  if (input.othersPassing) return no("others passing");
  return yes("house fills");
}
