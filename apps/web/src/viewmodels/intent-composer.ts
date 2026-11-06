import type { BannerVM, PresenceVM, RawAmount } from "./common";
import type { CurveChartVM } from "./curve";

export type PresetId = "fast" | "balanced" | "patient";
export type GateId = "open" | "listed" | "named";
export type CurveModeId = "absolute" | "pegged";

export interface IntentComposerPatch {
  amountIn?: string;
  preset?: PresetId;
  gate?: GateId;
  namedLabels?: string;
  mode?: CurveModeId;
  oracleWindowSec?: string;
  startBps?: string;
  floorBps?: string;
  hardFloorPercent?: string;
}

export interface IntentComposerVM {
  sellSymbol: string;
  buySymbol: string;
  sellBalance: string;
  buyBalance: string;
  sellRaw?: RawAmount;
  amountIn: string;
  preset: PresetId;
  presets: Array<{ id: PresetId; label: string; summary: string }>;
  gate: GateId;
  gateOptions: Array<{ id: GateId; label: string; enabled: boolean }>;
  namedLabels: string;
  mode: CurveModeId;
  peggedEnabled: boolean;
  oracleWindowSec: string;
  startBps: string;
  floorBps: string;
  hardFloorPercent: string;
  poolQuote: string;
  twap: string;
  solversOnline: string;
  presence: PresenceVM;
  preview: CurveChartVM;
  floorLine: string;
  validationMessages: string[];
  canSubmit: boolean;
  submitLabel: string;
  faucetLabel: string;
  canFaucet: boolean;
  banner?: BannerVM;
  onChange: (patch: IntentComposerPatch) => void;
  onSubmit: () => void;
  onFaucet: () => void;
}
