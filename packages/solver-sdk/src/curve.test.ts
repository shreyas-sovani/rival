import { describe, expect, it } from "vitest";
import { floorDiv, outputCurve } from "./curve.ts";

describe("output curve", () => {
  it("floors a negative decay term toward −infinity", () => {
    expect(floorDiv(-5n, 2n)).toBe(-3n);
    const point = outputCurve({
      now: 1n,
      start: 0n,
      decaySecs: 2n,
      startBps: -1n,
      floorBps: 0n,
      base: 10_000n,
      hardMinOut: 1n,
    });
    expect(point.elapsed).toBe(1n);
    expect(point.bps).toBe(0n);
    expect(point.required).toBe(10_000n);
  });

  it("matches the worked example where bps goes negative", () => {
    const point = outputCurve({
      now: 45n,
      start: 0n,
      decaySecs: 90n,
      startBps: 20n,
      floorBps: -30n,
      base: 3_000_000_000n,
      hardMinOut: 1n,
    });
    expect(point.elapsed).toBe(45n);
    expect(point.bps).toBe(-5n);
    expect(point.required).toBe(2_998_500_000n);
  });

  it("clamps elapsed and never returns below the hard floor", () => {
    const early = outputCurve({
      now: 0n,
      start: 50n,
      decaySecs: 90n,
      startBps: 20n,
      floorBps: -30n,
      base: 3_000_000_000n,
      hardMinOut: 1n,
    });
    expect(early.elapsed).toBe(0n);
    expect(early.bps).toBe(20n);

    const late = outputCurve({
      now: 10_000n,
      start: 0n,
      decaySecs: 90n,
      startBps: 20n,
      floorBps: -30n,
      base: 3_000_000_000n,
      hardMinOut: 3_010_000_000n,
    });
    expect(late.elapsed).toBe(90n);
    expect(late.bps).toBe(-30n);
    expect(late.required).toBe(3_010_000_000n);
  });

  it("ceils a negative bps that does not divide evenly", () => {
    const point = outputCurve({
      now: 0n,
      start: 0n,
      decaySecs: 10n,
      startBps: -1n,
      floorBps: -1n,
      base: 100n,
      hardMinOut: 1n,
    });
    expect(point.bps).toBe(-1n);
    expect(point.required).toBe(100n);
  });
});
