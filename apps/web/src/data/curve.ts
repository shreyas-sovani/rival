import { requiredAt, type Intent } from "@rival/intent";

type CurveIntent = Pick<Intent, "mode" | "baseOut" | "startBps" | "floorBps" | "startTime" | "decaySecs" | "hardMinOut">;

/** Required output at each timestamp. Uses `packages/intent` `requiredAt` unchanged. */
export function requiredOutputsAt(intent: CurveIntent, timestamps: readonly number[], quoteOut: bigint): bigint[] {
  return timestamps.map(
    (ts) =>
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
