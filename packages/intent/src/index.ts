export { buildIntent, type BuildIntentInput } from "./build.ts";
export { hashIntent, permit2TypedData, verifyIntentSignature, type Permit2TypedData } from "./eip712.ts";
export { receiptMath as receiptMathCore, requiredAt } from "./math.ts";
export { hardFloorFromQuote, presets, type Preset, type PresetId } from "./presets.ts";
export type { Address, Gate, Hex, Intent, IntentDomain, Mode, TypedDataField } from "./types.ts";

import { receiptMath as coreReceipt } from "./math.ts";

/** Public receipt helper. `curveBps` is recorded by the caller; it does not change the improvement formula. */
export function receiptMath(args: {
  amountOut: bigint;
  fairOut: bigint;
  poolFee: number;
  curveBps: number;
  elapsed: number;
}): {
  fairOut: bigint;
  fairOutAfterFee: bigint;
  improvementBps: number;
  elapsed: number;
} {
  if (!Number.isInteger(args.curveBps)) {
    throw new Error("BadParams");
  }
  const core = coreReceipt({
    amountOut: args.amountOut,
    fairOut: args.fairOut,
    poolFee: args.poolFee,
    elapsed: args.elapsed,
  });
  return {
    fairOut: core.fairOut,
    fairOutAfterFee: core.fairOutAfterFee,
    improvementBps: core.improvementBps,
    elapsed: args.elapsed,
  };
}
