/**
 * Block-start TWAP reference model. Integer rules match `RivalOracleHook`.
 * No network. `floorDiv` rounds toward negative infinity.
 */
import { floorDiv } from "./math.ts";

export { floorDiv };

export const RING = 256;
export const MIN_WINDOW = 60;
export const MAX_WINDOW = 3600;
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

const INT56_MOD = 1n << 56n;
const INT56_SIGN = 1n << 55n;
const MASK_256 = (1n << 256n) - 1n;
const Q128 = 1n << 128n;
const UINT128_MAX = (1n << 128n) - 1n;

export class OracleModelError extends Error {
  constructor(message: "WindowOutOfRange" | "InsufficientHistory" | "InvalidTick") {
    super(message);
    this.name = message;
  }
}

export interface Observation {
  ts: number;
  tickCumulative: bigint;
  blockStartTick: number;
}

export interface OracleState {
  observations: Array<Observation | undefined>;
  index: number;
  cardinality: number;
  slot0Tick: number;
}

export interface SwapEvent {
  dt: number;
  tickAfter: number;
}

export interface Sequence {
  t0: number;
  tick0: number;
  window: number;
  events: SwapEvent[];
  tail: number;
}

export interface SequenceResult extends Sequence {
  avg: number;
  index: number;
  card: number;
  cum: bigint[];
  ts: number[];
  bst: number[];
}

export interface QuoteGolden {
  tick: number;
  amountIn: bigint;
  zeroForOne: boolean;
  amountOut: bigint;
}

/** Signed wrap into int56, matching unchecked Solidity. */
export function toInt56(x: bigint): bigint {
  let v = x % INT56_MOD;
  if (v < 0n) v += INT56_MOD;
  if (v >= INT56_SIGN) v -= INT56_MOD;
  return v;
}

function addInt56(a: bigint, b: bigint): bigint {
  return toInt56(a + b);
}

function mulInt56(a: bigint, b: bigint): bigint {
  return toInt56(toInt56(a) * toInt56(b));
}

function u32(n: number): number {
  return n >>> 0;
}

export function seed(ts: number, tick: number): OracleState {
  const observations: Array<Observation | undefined> = new Array(RING);
  observations[0] = { ts: u32(ts), tickCumulative: 0n, blockStartTick: tick };
  return { observations, index: 0, cardinality: 1, slot0Tick: tick };
}

export function recordObservation(state: OracleState, now: number): void {
  if (state.cardinality === 0) return;
  const nowTs = u32(now);
  const latest = mustObs(state, state.index);
  if (nowTs === latest.ts) return;
  const dt = u32(nowTs - latest.ts);
  const newCum = addInt56(latest.tickCumulative, mulInt56(BigInt(state.slot0Tick), BigInt(dt)));
  let nextIndex: number;
  if (state.cardinality < RING) {
    nextIndex = state.cardinality;
    state.cardinality += 1;
  } else {
    nextIndex = (state.index + 1) % RING;
  }
  state.observations[nextIndex] = { ts: nowTs, tickCumulative: newCum, blockStartTick: state.slot0Tick };
  state.index = nextIndex;
}

export function applySwap(state: OracleState, now: number, tickAfter: number): void {
  recordObservation(state, now);
  state.slot0Tick = tickAfter;
}

export function oldestTimestamp(state: OracleState): number {
  if (state.cardinality === 0) return 0;
  const oldest = (state.index + 1) % state.cardinality;
  return mustObs(state, oldest).ts;
}

export function chronological(state: OracleState): Observation[] {
  if (state.cardinality === 0) return [];
  const start = (state.index + 1) % state.cardinality;
  const out: Observation[] = [];
  for (let n = 0; n < state.cardinality; n++) {
    const obs = mustObs(state, (start + n) % state.cardinality);
    out.push({ ts: obs.ts, tickCumulative: obs.tickCumulative, blockStartTick: obs.blockStartTick });
  }
  return out;
}

export function consult(state: OracleState, now: number, window: number): number {
  if (!Number.isInteger(window) || window < MIN_WINDOW || window > MAX_WINDOW) {
    throw new OracleModelError("WindowOutOfRange");
  }
  if (state.cardinality === 0) throw new OracleModelError("InsufficientHistory");
  const nowTs = u32(now);
  const target = u32(nowTs - window);
  const latest = mustObs(state, state.index);
  const tickEnd = latest.ts === nowTs ? latest.blockStartTick : state.slot0Tick;
  if (oldestTimestamp(state) > target) throw new OracleModelError("InsufficientHistory");
  const cumNow = cumAt(state, nowTs, tickEnd);
  const cumTarget = cumAt(state, target, tickEnd);
  return Number(floorDiv(cumNow - cumTarget, BigInt(window)));
}

export function quote(
  state: OracleState,
  now: number,
  zeroForOne: boolean,
  amountIn: bigint,
  window: number,
): bigint {
  const avg = consult(state, now, window);
  return getQuoteAtTick(avg, amountIn, zeroForOne);
}

function cumAt(state: OracleState, time: number, tickEnd: number): bigint {
  const latest = mustObs(state, state.index);
  if (time >= latest.ts) {
    const dt = u32(time - latest.ts);
    return addInt56(latest.tickCumulative, mulInt56(BigInt(tickEnd), BigInt(dt)));
  }
  const { o1, o2 } = binarySearch(state, time);
  const dt = u32(time - o1.ts);
  return addInt56(o1.tickCumulative, mulInt56(BigInt(o2.blockStartTick), BigInt(dt)));
}

function binarySearch(state: OracleState, time: number): { o1: Observation; o2: Observation } {
  const card = state.cardinality;
  let l = (state.index + 1) % card;
  let r = l + card - 1;
  for (let n = 0; n < 16; n++) {
    const i = Math.floor((l + r) / 2);
    const o1 = mustObs(state, i % card);
    const o2 = mustObs(state, (i + 1) % card);
    if (o1.ts <= time && time < o2.ts) return { o1, o2 };
    if (o1.ts > time) r = i - 1;
    else l = i + 1;
  }
  throw new OracleModelError("InsufficientHistory");
}

function mustObs(state: OracleState, slot: number): Observation {
  const obs = state.observations[slot];
  if (!obs) throw new Error(`empty observation slot ${slot}`);
  return obs;
}

/**
 * Uniswap v4 `TickMath.getSqrtPriceAtTick`. Q64.96.
 * Multiplications wrap at 256 bits, matching unchecked Solidity.
 */
export function getSqrtPriceAtTick(tick: number): bigint {
  if (!Number.isInteger(tick) || tick < MIN_TICK || tick > MAX_TICK) {
    throw new OracleModelError("InvalidTick");
  }
  const absTick = tick < 0 ? -tick : tick;
  let price = (absTick & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594001n : Q128;
  if (absTick & 0x2) price = mulShift(price, 0xfff97272373d413259a46990580e213an);
  if (absTick & 0x4) price = mulShift(price, 0xfff2e50f5f656932ef12357cf3c7fdccn);
  if (absTick & 0x8) price = mulShift(price, 0xffe5caca7e10e4e61c3624eaa0941cd0n);
  if (absTick & 0x10) price = mulShift(price, 0xffcb9843d60f6159c9db58835c926644n);
  if (absTick & 0x20) price = mulShift(price, 0xff973b41fa98c081472e6896dfb254c0n);
  if (absTick & 0x40) price = mulShift(price, 0xff2ea16466c96a3843ec78b326b52861n);
  if (absTick & 0x80) price = mulShift(price, 0xfe5dee046a99a2a811c461f1969c3053n);
  if (absTick & 0x100) price = mulShift(price, 0xfcbe86c7900a88aedcffc83b479aa3a4n);
  if (absTick & 0x200) price = mulShift(price, 0xf987a7253ac413176f2b074cf7815e54n);
  if (absTick & 0x400) price = mulShift(price, 0xf3392b0822b70005940c7a398e4b70f3n);
  if (absTick & 0x800) price = mulShift(price, 0xe7159475a2c29b7443b29c7fa6e889d9n);
  if (absTick & 0x1000) price = mulShift(price, 0xd097f3bdfd2022b8845ad8f792aa5825n);
  if (absTick & 0x2000) price = mulShift(price, 0xa9f746462d870fdf8a65dc1f90e061e5n);
  if (absTick & 0x4000) price = mulShift(price, 0x70d869a156d2a1b890bb3df62baf32f7n);
  if (absTick & 0x8000) price = mulShift(price, 0x31be135f97d08fd981231505542fcfa6n);
  if (absTick & 0x10000) price = mulShift(price, 0x9aa508b5b7a84e1c677de54f3e99bc9n);
  if (absTick & 0x20000) price = mulShift(price, 0x5d6af8dedb81196699c329225ee604n);
  if (absTick & 0x40000) price = mulShift(price, 0x2216e584f5fa1ea926041bedfe98n);
  if (absTick & 0x80000) price = mulShift(price, 0x48a170391f7dc42444e8fa2n);
  if (tick > 0) price = MASK_256 / price;
  return (price + 0xffffffffn) >> 32n;
}

function mulShift(price: bigint, constant: bigint): bigint {
  return ((price * constant) & MASK_256) >> 128n;
}

/** 512-bit floor(a*b/d). Reverts in spirit when the result does not fit in uint256. */
export function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("division by zero");
  const prod = a * b;
  const result = prod / denominator;
  if (result > MASK_256) throw new Error("mulDiv overflow");
  return result;
}

/** Uniswap v3 `OracleLibrary.getQuoteAtTick`. `zeroForOne` multiplies by price. */
export function getQuoteAtTick(tick: number, baseAmount: bigint, zeroForOne: boolean): bigint {
  if (baseAmount < 0n || baseAmount > UINT128_MAX) throw new Error("amountIn out of uint128");
  const sqrtPriceX96 = getSqrtPriceAtTick(tick);
  if (sqrtPriceX96 <= UINT128_MAX) {
    const ratioX192 = sqrtPriceX96 * sqrtPriceX96;
    return zeroForOne
      ? mulDiv(ratioX192, baseAmount, 1n << 192n)
      : mulDiv(1n << 192n, baseAmount, ratioX192);
  }
  const ratioX128 = mulDiv(sqrtPriceX96, sqrtPriceX96, 1n << 64n);
  return zeroForOne ? mulDiv(ratioX128, baseAmount, 1n << 128n) : mulDiv(1n << 128n, baseAmount, ratioX128);
}

export function replay(seq: Sequence): SequenceResult {
  const state = seed(seq.t0, seq.tick0);
  let now = u32(seq.t0);
  for (const ev of seq.events) {
    now = u32(now + ev.dt);
    applySwap(state, now, ev.tickAfter);
  }
  now = u32(now + seq.tail);
  const avg = consult(state, now, seq.window);
  const rows = chronological(state);
  return {
    ...seq,
    events: seq.events.map((ev) => ({ dt: ev.dt, tickAfter: ev.tickAfter })),
    avg,
    index: state.index,
    card: state.cardinality,
    cum: rows.map((o) => o.tickCumulative),
    ts: rows.map((o) => o.ts),
    bst: rows.map((o) => o.blockStartTick),
  };
}

export function serializeSequence(row: SequenceResult): string {
  const dt = row.events.map((ev) => ev.dt).join(",");
  const after = row.events.map((ev) => ev.tickAfter).join(",");
  const cum = row.cum.map((c) => c.toString()).join(",");
  const ts = row.ts.join(",");
  const bst = row.bst.join(",");
  return `{"t0":${row.t0},"tick0":${row.tick0},"window":${row.window},"tail":${row.tail},"dt":[${dt}],"after":[${after}],"avg":${row.avg},"index":${row.index},"card":${row.card},"cum":[${cum}],"ts":[${ts}],"bst":[${bst}]}`;
}

/** Fixed sequences plus seeded random rows. Always 1000 lines, deterministic. */
export function generateVectors(count = 1000): SequenceResult[] {
  const hands = handSequences();
  const rng = mulberry32(0x0c0ffee);
  const out: SequenceResult[] = [];
  for (const seq of hands) out.push(replay(seq));
  while (out.length < count) out.push(replay(randomSequence(rng)));
  return out.slice(0, count);
}

export function handSequences(): Sequence[] {
  return [
    { t0: 3_000_000, tick0: -42, window: 60, events: [], tail: 120 },
    {
      t0: 2_000_000,
      tick0: 100,
      window: 60,
      events: [
        { dt: 60, tickAfter: 5000 },
        { dt: 0, tickAfter: -8000 },
      ],
      tail: 0,
    },
    {
      t0: 1_000_000,
      tick0: 0,
      window: 60,
      events: [{ dt: 40, tickAfter: -7 }],
      tail: 20,
    },
    { t0: 4_000_000, tick0: 7, window: 3600, events: [], tail: 3600 },
    wrapSequence(),
  ];
}

function wrapSequence(): Sequence {
  const events: SwapEvent[] = [];
  let tick = 0;
  for (let i = 0; i < 300; i++) {
    tick = i % 2 === 0 ? tick + 17 : tick - 9;
    events.push({ dt: 1, tickAfter: tick });
  }
  return { t0: 5_000_000, tick0: 0, window: 60, events, tail: 0 };
}

function randomSequence(rng: () => number): Sequence {
  const t0 = irand(rng, 1_600_000_000, 1_700_000_000);
  const tick0 = irand(rng, -20_000, 20_000);
  const window = irand(rng, MIN_WINDOW, MAX_WINDOW);
  const n = irand(rng, 1, 8);
  const events: SwapEvent[] = [];
  let elapsed = 0;
  let tick = tick0;
  for (let i = 0; i < n; i++) {
    let dt = irand(rng, 0, 240);
    if (i === n - 1 && elapsed + dt < window) dt = window - elapsed;
    elapsed += dt;
    const next = clampTick(tick + irand(rng, -400, 400));
    events.push({ dt, tickAfter: next });
    tick = next;
  }
  const tail = elapsed < window ? window - elapsed : irand(rng, 0, 40);
  return { t0, tick0, window, events, tail };
}

function clampTick(tick: number): number {
  if (tick < MIN_TICK) return MIN_TICK;
  if (tick > MAX_TICK) return MAX_TICK;
  return tick;
}

function irand(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Frozen `getQuoteAtTick` outputs. The Foundry golden test repeats these integers.
 * Tick 500000 uses the Q128 branch (sqrt price above uint128 max) and is initializable.
 */
export const QUOTE_GOLDENS: QuoteGolden[] = [
  { tick: 0, amountIn: 0n, zeroForOne: true, amountOut: 0n },
  { tick: 0, amountIn: 1n, zeroForOne: true, amountOut: 1n },
  { tick: 0, amountIn: 10n ** 18n, zeroForOne: false, amountOut: 10n ** 18n },
  { tick: 1, amountIn: 1_000_000n, zeroForOne: true, amountOut: 1_000_100n },
  { tick: 1, amountIn: 1_000_000n, zeroForOne: false, amountOut: 999_900n },
  { tick: -1, amountIn: 1_000_000n, zeroForOne: true, amountOut: 999_900n },
  { tick: -1, amountIn: 1_000_000n, zeroForOne: false, amountOut: 1_000_099n },
  { tick: 100, amountIn: 1_000_000n, zeroForOne: true, amountOut: 1_010_049n },
  { tick: -100, amountIn: 1_000_000n, zeroForOne: false, amountOut: 1_010_049n },
  { tick: 6931, amountIn: 1_000_000n, zeroForOne: true, amountOut: 1_999_836n },
  { tick: -6931, amountIn: 1_000_000n, zeroForOne: true, amountOut: 500_040n },
  { tick: 200_000, amountIn: 1_000_000n, zeroForOne: true, amountOut: 484_680_305_025_733n },
  { tick: 200_000, amountIn: 10n ** 18n, zeroForOne: false, amountOut: 2_063_215_669n },
  { tick: 500_000, amountIn: 1n, zeroForOne: true, amountOut: 5_171_760_815_372_400_971_558n },
  { tick: -887_272, amountIn: 1000n, zeroForOne: false, amountOut: 340_256_786_698_763_678_858_396_856_460_488_307_819_979n },
];
