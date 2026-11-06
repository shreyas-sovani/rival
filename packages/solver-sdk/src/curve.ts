/** Output curve. Floor division rounds toward −infinity so a negative decay term does not truncate toward zero. */

const BPS_DENOM = 10_000n;

export function floorDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("division by zero");
  const q = n / d;
  const r = n % d;
  if (r !== 0n && n < 0n !== d < 0n) return q - 1n;
  return q;
}

export function ceilDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("division by zero");
  const q = n / d;
  const r = n % d;
  if (r !== 0n && n < 0n === d < 0n) return q + 1n;
  return q;
}

export interface CurveInput {
  now: bigint;
  start: bigint;
  decaySecs: bigint;
  startBps: bigint;
  floorBps: bigint;
  base: bigint;
  hardMinOut: bigint;
}

export interface CurvePoint {
  elapsed: bigint;
  bps: bigint;
  required: bigint;
}

/**
 * elapsed = clamp(now − start, 0, decaySecs)
 * bps = startBps − floor((startBps − floorBps) * elapsed / decaySecs)
 * required = max(ceil(base * (10000 + bps) / 10000), hardMinOut)
 */
export function outputCurve(input: CurveInput): CurvePoint {
  if (input.decaySecs <= 0n) throw new Error("bad params");
  let elapsed = input.now - input.start;
  if (elapsed < 0n) elapsed = 0n;
  if (elapsed > input.decaySecs) elapsed = input.decaySecs;
  const decayed = floorDiv((input.startBps - input.floorBps) * elapsed, input.decaySecs);
  const bps = input.startBps - decayed;
  const curveOut = ceilDiv(input.base * (BPS_DENOM + bps), BPS_DENOM);
  const required = curveOut > input.hardMinOut ? curveOut : input.hardMinOut;
  return { elapsed, bps, required };
}
