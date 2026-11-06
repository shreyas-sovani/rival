/**
 * Writes `packages/intent/vectors.json`. Re-run after any math change.
 * The file is the parity oracle for `RivalMath.t.sol` (M-011).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { receiptMath, requiredAt, type CurveInput } from "./math.ts";

export interface Vector {
  id: string;
  mode: 0 | 1;
  baseOut: string;
  quoteOut: string;
  startBps: number;
  floorBps: number;
  startTime: number;
  decaySecs: number;
  hardMinOut: string;
  ts: number;
  zeroForOne: boolean;
  poolFee: number;
  fairOut: string;
  required: string;
  curveBps: number;
  base: string;
  curveOut: string;
  elapsed: number;
  fairOutAfterFee: string;
  improvementBps: number;
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state;
  };
}

function between(next: () => number, lo: number, hi: number): number {
  return lo + (next() % (hi - lo + 1));
}

function row(id: string, input: CurveInput, poolFee: number, fairOut: bigint, zeroForOne: boolean): Vector {
  const curve = requiredAt(input);
  const receipt = receiptMath({
    amountOut: curve.required,
    fairOut,
    poolFee,
    elapsed: curve.elapsed,
  });
  return {
    id,
    mode: input.mode,
    baseOut: input.baseOut.toString(),
    quoteOut: input.quoteOut.toString(),
    startBps: input.startBps,
    floorBps: input.floorBps,
    startTime: input.startTime,
    decaySecs: input.decaySecs,
    hardMinOut: input.hardMinOut.toString(),
    ts: input.ts,
    zeroForOne,
    poolFee,
    fairOut: fairOut.toString(),
    required: curve.required.toString(),
    curveBps: curve.curveBps,
    base: curve.base.toString(),
    curveOut: curve.curveOut.toString(),
    elapsed: curve.elapsed,
    fairOutAfterFee: receipt.fairOutAfterFee.toString(),
    improvementBps: receipt.improvementBps,
  };
}

const workedBase = 3_000_000_000n;
const workedHard = 2_955_000_000n;

function worked(elapsed: number, zeroForOne: boolean): Vector {
  return row(
    `worked-${elapsed}-${zeroForOne ? "1" : "0"}`,
    {
      mode: 1,
      baseOut: 0n,
      quoteOut: workedBase,
      startBps: 20,
      floorBps: -30,
      startTime: 1_700_000_000,
      decaySecs: 90,
      hardMinOut: workedHard,
      ts: 1_700_000_000 + elapsed,
    },
    500,
    workedBase,
    zeroForOne,
  );
}

export function buildVectors(): Vector[] {
  const out: Vector[] = [];
  for (const elapsed of [0, 18, 45, 90]) {
    out.push(worked(elapsed, false), worked(elapsed, true));
  }
  out.push(
    row(
      "edge-before-start",
      {
        mode: 0,
        baseOut: workedBase,
        quoteOut: 0n,
        startBps: 20,
        floorBps: -30,
        startTime: 500,
        decaySecs: 90,
        hardMinOut: 1n,
        ts: 100,
      },
      500,
      workedBase,
      false,
    ),
    row(
      "edge-past-decay",
      {
        mode: 0,
        baseOut: workedBase,
        quoteOut: 0n,
        startBps: 20,
        floorBps: -30,
        startTime: 0,
        decaySecs: 90,
        hardMinOut: 1n,
        ts: 10_000,
      },
      3000,
      workedBase,
      true,
    ),
    row(
      "edge-flat-negative",
      {
        mode: 0,
        baseOut: workedBase,
        quoteOut: 0n,
        startBps: -10,
        floorBps: -10,
        startTime: 0,
        decaySecs: 30,
        hardMinOut: 1n,
        ts: 15,
      },
      500,
      0n,
      false,
    ),
    row(
      "edge-hard-floor",
      {
        mode: 1,
        baseOut: 0n,
        quoteOut: workedBase,
        startBps: 20,
        floorBps: -30,
        startTime: 0,
        decaySecs: 90,
        hardMinOut: 3_010_000_000n,
        ts: 0,
      },
      500,
      workedBase,
      true,
    ),
  );

  const next = lcg(0x0c0ffee);
  for (let i = 0; i < 10_000; i++) {
    const startBps = between(next, -5000, 5000);
    const floorBps = between(next, -5000, startBps);
    const decaySecs = between(next, 10, 3600);
    const startTime = between(next, 0, 2_000_000_000);
    const ts = startTime + between(next, 0, decaySecs + 50);
    const mode = (next() & 1) === 0 ? 0 : 1;
    const hi = BigInt(next());
    const lo = BigInt(next() % 1_000_000);
    const magnitude = hi * 1_000_000n + lo + 1n;
    const hardMinOut = (magnitude * BigInt(between(next, 1, 12_000))) / 10_000n + 1n;
    const poolFee = next() % 2 === 0 ? 500 : 3000;
    const fairChoice = next() % 20;
    const fairOut = fairChoice === 0 ? 0n : magnitude;
    out.push(
      row(
        `rand-${i}`,
        {
          mode,
          baseOut: mode === 0 ? magnitude : 0n,
          quoteOut: mode === 1 ? magnitude : 0n,
          startBps,
          floorBps,
          startTime,
          decaySecs,
          hardMinOut,
          ts,
        },
        poolFee,
        fairOut,
        (next() & 1) === 1,
      ),
    );
  }
  return out;
}

const invokedDirectly = process.argv[1]?.includes("vectors-build") === true;
if (invokedDirectly) {
  const here = dirname(fileURLToPath(import.meta.url));
  const target = join(here, "..", "vectors.json");
  const vectors = buildVectors();
  mkdirSync(dirname(target), { recursive: true });
  // One object per line. The file is named vectors.json because that is the shared path.
  // Solidity reads it with `vm.readLine`; a single JSON document is too large for the EVM.
  writeFileSync(target, `${vectors.map((vector) => JSON.stringify(vector)).join("\n")}\n`);
  console.log(`wrote ${vectors.length} vectors to ${target}`);
}
