import { requiredAt } from "@rival/intent";
import { describe, expect, it } from "vitest";
import { requiredOutputsAt } from "./curve.ts";

describe("curve preview", () => {
  it("matches requiredAt at 20 timestamps", () => {
    const intent = {
      mode: 1 as const,
      baseOut: 0n,
      startBps: 20,
      floorBps: -30,
      startTime: 1_000,
      decaySecs: 90,
      hardMinOut: 2_955_000_000n,
    };
    const quoteOut = 3_000_000_000n;
    const timestamps = Array.from({ length: 20 }, (_, i) => 990 + i * 10);
    const outputs = requiredOutputsAt(intent, timestamps, quoteOut);

    expect(outputs).toHaveLength(20);
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      if (ts === undefined) throw new Error("missing timestamp");
      expect(outputs[i]).toBe(
        requiredAt({
          mode: intent.mode,
          baseOut: intent.baseOut,
          quoteOut,
          startBps: intent.startBps,
          floorBps: intent.floorBps,
          startTime: intent.startTime,
          decaySecs: intent.decaySecs,
          hardMinOut: intent.hardMinOut,
          ts,
        }).required,
      );
    }
  });
});
