import { encodePacked, keccak256, type Hex } from "viem";
import { hardFloorFromQuote, presets, type PresetId } from "./presets.ts";
import type { Address, Gate, Intent, Mode } from "./types.ts";

const ZERO_BYTES32: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface BuildIntentInput {
  maker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  recipient?: Address;
  preset?: PresetId;
  mode?: Mode;
  baseOut?: bigint;
  oracleWindow?: number;
  startBps?: number;
  floorBps?: number;
  startTime?: number;
  decaySecs?: number;
  deadline?: number;
  hardMinOut?: bigint;
  gate?: Gate;
  allowLabels?: Hex[];
  nonce: bigint;
  oracleQuoteOut?: bigint;
}

function allowlistHash(labels: readonly Hex[]): Hex {
  if (labels.length === 0) {
    return keccak256(encodePacked([], []));
  }
  return keccak256(encodePacked(labels.map(() => "bytes32" as const), [...labels]));
}

/** Assemble an intent from a preset plus overrides. Amounts stay in base units. */
export function buildIntent(input: BuildIntentInput): Intent {
  const preset = presets[input.preset ?? "balanced"];
  const mode = input.mode ?? 1;
  const decaySecs = input.decaySecs ?? preset.decaySecs;
  const startBps = input.startBps ?? preset.startBps;
  const floorBps = input.floorBps ?? preset.floorBps;
  const startTime = input.startTime ?? 0;
  const deadline = input.deadline ?? startTime + decaySecs + preset.deadlineBufferSecs;
  const oracleWindow = input.oracleWindow ?? 60;
  const gate = input.gate ?? 0;
  let hardMinOut = input.hardMinOut;
  if (hardMinOut === undefined) {
    if (input.oracleQuoteOut === undefined) {
      throw new Error("BadParams");
    }
    hardMinOut = hardFloorFromQuote(input.oracleQuoteOut, preset.hardFloorRatioBps);
  }
  if (input.amountIn <= 0n || hardMinOut <= 0n) {
    throw new Error("BadParams");
  }
  if (startBps < floorBps || decaySecs < 10 || decaySecs > 3600) {
    throw new Error("BadParams");
  }
  if (deadline <= startTime || deadline > startTime + 86_400) {
    throw new Error("BadParams");
  }
  if (mode === 1 && (oracleWindow < 60 || oracleWindow > 3600)) {
    throw new Error("BadParams");
  }
  const labels = input.allowLabels ?? [];
  return {
    maker: input.maker,
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    amountIn: input.amountIn,
    recipient: input.recipient ?? input.maker,
    mode,
    baseOut: input.baseOut ?? 0n,
    oracleWindow,
    startBps,
    floorBps,
    startTime,
    decaySecs,
    deadline,
    hardMinOut,
    gate,
    allowlistHash: gate === 2 ? allowlistHash(labels) : ZERO_BYTES32,
    nonce: input.nonce,
  };
}
