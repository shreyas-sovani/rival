/**
 * Curve and receipt math (PRD §7.2). Integer division matches the Solidity twin in M-011.
 * `floorDiv` rounds toward −infinity. `ceilDiv` rounds toward +infinity.
 * `truncDiv` rounds toward zero and is the improvement division.
 * The decay numerator `(startBps - floorBps) * elapsed` is non-negative for in-bounds intents,
 * so `floorDiv` and toward-zero division agree on that step. The helper still implements
 * mathematical floor so negative-numerator vectors stay aligned with Solidity.
 */

export const BPS_DENOM = 10_000n;
export const FEE_DENOM = 1_000_000n;
export const IMPROVEMENT_SENTINEL = -2_147_483_648;

export function floorDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) {
    throw new Error("division by zero");
  }
  const q = n / d;
  const r = n % d;
  if (r !== 0n && n < 0n !== d < 0n) {
    return q - 1n;
  }
  return q;
}

export function ceilDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) {
    throw new Error("division by zero");
  }
  const q = n / d;
  const r = n % d;
  if (r !== 0n && n < 0n === d < 0n) {
    return q + 1n;
  }
  return q;
}

/** Truncation toward zero. JavaScript bigint `/` already does this. */
export function truncDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) {
    throw new Error("division by zero");
  }
  return n / d;
}

export function clampBig(n: bigint, lo: bigint, hi: bigint): bigint {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

export function clampInt(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

export interface CurveInput {
  /** 0 absolute, 1 pegged. */
  mode: 0 | 1;
  /** Absolute reference output. Ignored when `mode` is 1. */
  baseOut: bigint;
  /** Hook quote. Ignored when `mode` is 0. */
  quoteOut: bigint;
  startBps: number;
  floorBps: number;
  startTime: number;
  decaySecs: number;
  hardMinOut: bigint;
  ts: number;
}

export interface CurveResult {
  required: bigint;
  curveBps: number;
  base: bigint;
  elapsed: number;
  curveOut: bigint;
}

export function assertCurveParams(input: CurveInput): void {
  const { startBps, floorBps, decaySecs, hardMinOut } = input;
  if (!Number.isInteger(startBps) || !Number.isInteger(floorBps) || !Number.isInteger(decaySecs)) {
    throw new Error("BadParams");
  }
  if (startBps < -5000 || startBps > 5000 || floorBps < -5000 || floorBps > 5000 || startBps < floorBps) {
    throw new Error("BadParams");
  }
  if (decaySecs < 10 || decaySecs > 3600) {
    throw new Error("BadParams");
  }
  if (hardMinOut <= 0n) {
    throw new Error("BadParams");
  }
}

export function requiredAt(input: CurveInput): CurveResult {
  assertCurveParams(input);
  const base = input.mode === 1 ? input.quoteOut : input.baseOut;
  if (base < 0n) {
    throw new Error("BadParams");
  }
  const elapsed = clampInt(input.ts - input.startTime, 0, input.decaySecs);
  const span = input.startBps - input.floorBps;
  const decayed = floorDiv(BigInt(span) * BigInt(elapsed), BigInt(input.decaySecs));
  const curveBps = input.startBps - Number(decayed);
  const curveOut = ceilDiv(base * (BPS_DENOM + BigInt(curveBps)), BPS_DENOM);
  const required = curveOut > input.hardMinOut ? curveOut : input.hardMinOut;
  return { required, curveBps, base, elapsed, curveOut };
}

export interface ReceiptInput {
  amountOut: bigint;
  fairOut: bigint;
  /** Uniswap v4 fee in hundredths of a bip. 500 = 0.05%. */
  poolFee: number;
  elapsed: number;
}

export interface ReceiptResult {
  fairOut: bigint;
  fairOutAfterFee: bigint;
  improvementBps: number;
  elapsed: number;
}

export function receiptMath(input: ReceiptInput): ReceiptResult {
  if (input.poolFee < 0 || input.poolFee > 1_000_000) {
    throw new Error("BadParams");
  }
  if (input.fairOut === 0n) {
    return {
      fairOut: 0n,
      fairOutAfterFee: 0n,
      improvementBps: IMPROVEMENT_SENTINEL,
      elapsed: input.elapsed,
    };
  }
  const fairOutAfterFee = truncDiv(input.fairOut * (FEE_DENOM - BigInt(input.poolFee)), FEE_DENOM);
  if (fairOutAfterFee === 0n) {
    return {
      fairOut: input.fairOut,
      fairOutAfterFee: 0n,
      improvementBps: IMPROVEMENT_SENTINEL,
      elapsed: input.elapsed,
    };
  }
  const raw = truncDiv((input.amountOut - fairOutAfterFee) * BPS_DENOM, fairOutAfterFee);
  const improvementBps = Number(clampBig(raw, -10_000n, 10_000n));
  return {
    fairOut: input.fairOut,
    fairOutAfterFee,
    improvementBps,
    elapsed: input.elapsed,
  };
}
