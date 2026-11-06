import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  MAX_TICK,
  MIN_TICK,
  OracleModelError,
  QUOTE_GOLDENS,
  consult,
  generateVectors,
  getQuoteAtTick,
  getSqrtPriceAtTick,
  handSequences,
  oldestTimestamp,
  replay,
  seed,
  serializeSequence,
  toInt56,
  type OracleState,
} from "./oracle-model.ts";

const VECTOR_PATH = join(dirname(fileURLToPath(import.meta.url)), "../oracle-vectors.jsonl");

it("matches TickMath anchor prices", () => {
  expect(getSqrtPriceAtTick(0)).toBe(79228162514264337593543950336n);
  expect(getSqrtPriceAtTick(1)).toBe(79232123823359799118286999568n);
  expect(getSqrtPriceAtTick(MIN_TICK)).toBe(4295128739n);
  expect(getSqrtPriceAtTick(MAX_TICK)).toBe(1461446703485210103287273052203988822378723970342n);
});

it("matches frozen getQuoteAtTick goldens", () => {
  for (const row of QUOTE_GOLDENS) {
    expect(getQuoteAtTick(row.tick, row.amountIn, row.zeroForOne)).toBe(row.amountOut);
  }
});

it("quote is monotonic in amountIn", () => {
  for (const tick of [-200, -1, 0, 1, 960, 6931]) {
    for (const zeroForOne of [true, false]) {
      let prev = 0n;
      for (const amount of [0n, 1n, 2n, 999n, 1000n, 1_000_000n, 10n ** 18n]) {
        const out = getQuoteAtTick(tick, amount, zeroForOne);
        expect(out >= prev).toBe(true);
        prev = out;
      }
    }
  }
});

it("covers hand cases", () => {
  const [single, sameTs, negativeFloor, windowMax, wrap] = handSequences();
  if (!single || !sameTs || !negativeFloor || !windowMax || !wrap) throw new Error("hands");

  const singleRow = replay(single);
  expect(singleRow.avg).toBe(-42);
  expect(singleRow.card).toBe(1);
  expect(singleRow.cum).toEqual([0n]);
  expect(singleRow.bst).toEqual([-42]);

  const same = replay(sameTs);
  expect(same.avg).toBe(100);
  expect(same.card).toBe(2);
  const firstOnly = replay({ ...sameTs, events: sameTs.events.slice(0, 1) });
  expect(same.avg).toBe(firstOnly.avg);
  expect(same.cum).toEqual(firstOnly.cum);

  expect(replay(negativeFloor).avg).toBe(-3);
  expect(replay(windowMax).avg).toBe(7);
  expect(replay(windowMax).window).toBe(3600);

  const wrapped = replay(wrap);
  expect(wrapped.card).toBe(256);
  expect(wrapped.index).toBe(44);
});

it("rejects bad windows and empty history", () => {
  const state = seed(1_000_000, 0);
  expect(() => consult(state, 1_000_000, 59)).toThrow(OracleModelError);
  expect(() => consult(state, 1_000_000, 3601)).toThrow(/WindowOutOfRange/);
  expect(() => consult(state, 1_000_000, 60)).toThrow(/InsufficientHistory/);
  const empty: OracleState = { observations: new Array(256), index: 0, cardinality: 0, slot0Tick: 0 };
  expect(oldestTimestamp(empty)).toBe(0);
  expect(() => consult(empty, 2_000_000, 60)).toThrow(/InsufficientHistory/);
});

it("writes 1000 deterministic oracle vectors", () => {
  const first = generateVectors();
  const second = generateVectors();
  expect(first).toHaveLength(1000);
  const text = first.map(serializeSequence).join("\n") + "\n";
  expect(second.map(serializeSequence).join("\n") + "\n").toBe(text);

  for (const row of first) {
    expect(row.card).toBeGreaterThan(0);
    expect(row.card).toBeLessThanOrEqual(256);
    for (let i = 0; i < row.card - 1; i++) {
      const left = row.cum[i];
      const right = row.cum[i + 1];
      const bst = row.bst[i + 1];
      const ts0 = row.ts[i];
      const ts1 = row.ts[i + 1];
      if (left === undefined || right === undefined || bst === undefined || ts0 === undefined || ts1 === undefined) {
        throw new Error("short ring");
      }
      const dt = BigInt(ts1 - ts0);
      const expected = toInt56(left + toInt56(BigInt(bst) * dt));
      expect(right).toBe(expected);
    }
  }

  writeFileSync(VECTOR_PATH, text);
  expect(readFileSync(VECTOR_PATH, "utf8")).toBe(text);
  expect(text.split("\n").filter((line) => line.length > 0)).toHaveLength(1000);
});
