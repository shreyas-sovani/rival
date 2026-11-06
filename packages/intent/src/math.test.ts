import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ceilDiv, floorDiv, receiptMath, requiredAt, truncDiv } from "./math.ts";
import { hardFloorFromQuote, presets } from "./presets.ts";

const BASE = 3_000_000_000n;
const HARD = 2_955_000_000n;
const FAIR = 3_000_000_000n;

const worked = [
  { elapsed: 0, bps: 20, curve: 3_006_000_000n, improvement: 25 },
  { elapsed: 18, bps: 10, curve: 3_003_000_000n, improvement: 15 },
  { elapsed: 45, bps: -5, curve: 2_998_500_000n, improvement: 0 },
  { elapsed: 90, bps: -30, curve: 2_991_000_000n, improvement: -25 },
];

test("worked example table", () => {
  for (const row of worked) {
    const curve = requiredAt({
      mode: 1,
      baseOut: 0n,
      quoteOut: BASE,
      startBps: 20,
      floorBps: -30,
      startTime: 1_000,
      decaySecs: 90,
      hardMinOut: HARD,
      ts: 1_000 + row.elapsed,
    });
    assert.equal(curve.curveBps, row.bps);
    assert.equal(curve.curveOut, row.curve);
    assert.equal(curve.required, row.curve);
    assert.equal(curve.base, BASE);
    const receipt = receiptMath({
      amountOut: curve.required,
      fairOut: FAIR,
      poolFee: 500,
      elapsed: row.elapsed,
    });
    assert.equal(receipt.fairOutAfterFee, 2_998_500_000n);
    assert.equal(receipt.improvementBps, row.improvement);
  }
});

test("division helpers", () => {
  assert.equal(floorDiv(5n, 2n), 2n);
  assert.equal(floorDiv(-5n, 2n), -3n);
  assert.equal(floorDiv(5n, -2n), -3n);
  assert.equal(ceilDiv(5n, 2n), 3n);
  assert.equal(ceilDiv(-5n, 2n), -2n);
  assert.equal(truncDiv(-5n, 2n), -2n);
  assert.equal(ceilDiv(100n * 10_001n, 10_000n), 101n);
});

test("edges: zero elapsed, past decay, flat bps, negative bps, hard floor", () => {
  const zero = requiredAt({
    mode: 0,
    baseOut: BASE,
    quoteOut: 0n,
    startBps: 20,
    floorBps: -30,
    startTime: 500,
    decaySecs: 90,
    hardMinOut: 1n,
    ts: 100,
  });
  assert.equal(zero.elapsed, 0);
  assert.equal(zero.curveBps, 20);

  const past = requiredAt({
    mode: 0,
    baseOut: BASE,
    quoteOut: 0n,
    startBps: 20,
    floorBps: -30,
    startTime: 0,
    decaySecs: 90,
    hardMinOut: 1n,
    ts: 10_000,
  });
  assert.equal(past.elapsed, 90);
  assert.equal(past.curveBps, -30);

  const flat = requiredAt({
    mode: 0,
    baseOut: BASE,
    quoteOut: 0n,
    startBps: -10,
    floorBps: -10,
    startTime: 0,
    decaySecs: 30,
    hardMinOut: 1n,
    ts: 15,
  });
  assert.equal(flat.curveBps, -10);

  const floored = requiredAt({
    mode: 1,
    baseOut: 0n,
    quoteOut: BASE,
    startBps: 20,
    floorBps: -30,
    startTime: 0,
    decaySecs: 90,
    hardMinOut: 3_010_000_000n,
    ts: 0,
  });
  assert.equal(floored.curveOut, 3_006_000_000n);
  assert.equal(floored.required, 3_010_000_000n);
});

test("required is non-increasing and never below the hard floor", () => {
  const input = {
    mode: 1 as const,
    baseOut: 0n,
    quoteOut: 1_234_567_890n,
    startBps: 40,
    floorBps: -50,
    startTime: 10_000,
    decaySecs: 240,
    hardMinOut: hardFloorFromQuote(1_234_567_890n),
  };
  let prev = requiredAt({ ...input, ts: input.startTime }).required;
  for (let t = input.startTime; t <= input.startTime + input.decaySecs + 5; t++) {
    const next = requiredAt({ ...input, ts: t });
    assert.ok(next.required <= prev);
    assert.ok(next.required >= input.hardMinOut);
    prev = next.required;
  }
});

test("oracle unavailable receipt is the int32 sentinel", () => {
  const receipt = receiptMath({ amountOut: BASE, fairOut: 0n, poolFee: 500, elapsed: 0 });
  assert.equal(receipt.improvementBps, -2_147_483_648);
  assert.equal(receipt.fairOutAfterFee, 0n);
});

test("committed vectors match the TypeScript curve", () => {
  const vectors = readFileSync(new URL("../vectors.json", import.meta.url), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.ok(vectors.length >= 10_008);
  for (const vector of vectors) {
    const curve = requiredAt({
      mode: vector.mode,
      baseOut: BigInt(vector.baseOut),
      quoteOut: BigInt(vector.quoteOut),
      startBps: vector.startBps,
      floorBps: vector.floorBps,
      startTime: vector.startTime,
      decaySecs: vector.decaySecs,
      hardMinOut: BigInt(vector.hardMinOut),
      ts: vector.ts,
    });
    assert.equal(curve.required.toString(), vector.required);
    assert.equal(curve.curveBps, vector.curveBps);
    assert.ok(curve.required >= BigInt(vector.hardMinOut));
    const receipt = receiptMath({
      amountOut: curve.required,
      fairOut: BigInt(vector.fairOut),
      poolFee: vector.poolFee,
      elapsed: curve.elapsed,
    });
    assert.equal(receipt.improvementBps, vector.improvementBps);
  }
  const mid = vectors.find((vector) => vector.id === "worked-45-0");
  assert.equal(mid.curveBps, -5);
  assert.equal(mid.improvementBps, 0);
});

test("presets match FR-WEB-02", () => {
  assert.deepEqual(
    [presets.fast.decaySecs, presets.fast.startBps, presets.fast.floorBps],
    [30, 10, -20],
  );
  assert.deepEqual(
    [presets.balanced.decaySecs, presets.balanced.startBps, presets.balanced.floorBps],
    [90, 20, -30],
  );
  assert.deepEqual(
    [presets.patient.decaySecs, presets.patient.startBps, presets.patient.floorBps],
    [240, 40, -50],
  );
  assert.equal(presets.balanced.hardFloorRatioBps, 9850);
  assert.equal(presets.balanced.deadlineBufferSecs, 60);
  assert.equal(hardFloorFromQuote(BASE), 2_955_000_000n);
});
