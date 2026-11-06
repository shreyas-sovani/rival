/** FR-WEB-02 presets. Hard floor is 98.5% of the oracle quote. Deadline is start + decay + 60s. */

export type PresetId = "fast" | "balanced" | "patient";

export interface Preset {
  id: PresetId;
  decaySecs: number;
  startBps: number;
  floorBps: number;
  hardFloorRatioBps: number;
  deadlineBufferSecs: number;
}

export const presets: { readonly fast: Preset; readonly balanced: Preset; readonly patient: Preset } = {
  fast: { id: "fast", decaySecs: 30, startBps: 10, floorBps: -20, hardFloorRatioBps: 9850, deadlineBufferSecs: 60 },
  balanced: {
    id: "balanced",
    decaySecs: 90,
    startBps: 20,
    floorBps: -30,
    hardFloorRatioBps: 9850,
    deadlineBufferSecs: 60,
  },
  patient: {
    id: "patient",
    decaySecs: 240,
    startBps: 40,
    floorBps: -50,
    hardFloorRatioBps: 9850,
    deadlineBufferSecs: 60,
  },
};

/** `hardMinOut = floor(quote * 9850 / 10000)`. Floor (toward zero, quote is non-negative) so the signed floor is never above 98.5%. */
export function hardFloorFromQuote(quoteOut: bigint, ratioBps = presets.balanced.hardFloorRatioBps): bigint {
  if (quoteOut < 0n) {
    throw new Error("BadParams");
  }
  return (quoteOut * BigInt(ratioBps)) / 10_000n;
}
