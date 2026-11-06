"use client";

import { presets, type PresetId } from "@rival/intent";
import { PAIR } from "@rival/arkiv";
import { useMemo, useState } from "react";
import { CurveChartView } from "../components/views/CurveChartView.tsx";
import { IntentComposerView } from "../components/views/IntentComposerView.tsx";
import { requiredOutputsAt } from "../data/curve.ts";
import { signingSummary } from "../data/signing.ts";
import { formatUnitsFixed } from "../lib/format.ts";
import type { BannerVM } from "../viewmodels/common.ts";
import type { CurveChartVM } from "../viewmodels/curve.ts";
import type { CurveModeId, GateId, IntentComposerPatch, IntentComposerVM } from "../viewmodels/intent-composer.ts";
import { routes } from "../viewmodels/routes.ts";
import { RouteShell } from "./page.shell.tsx";

const SELL_DECIMALS = 18;
const BUY_DECIMALS = 6;
const SAMPLE_COUNT = 20;
/** Absolute curve base used only while the Quoter cannot be called. Not a pool price. */
const OFFLINE_ABSOLUTE_BASE = 1_000_000n;

const pairParts = PAIR.split("/");
const sellSymbol = pairParts[0] ?? "tWETH";
const buySymbol = pairParts[1] ?? "tUSDC";

const quoteBanner: BannerVM = {
  kind: "warn",
  text: "Live pool quote and TWAP are unavailable, so pegged mode is off. The curve is the offline absolute preview of this preset on a 1 tUSDC base, not a swap quote.",
};

function routeTitle(path: (typeof routes)[number]["path"]): string {
  return routes.find((route) => route.path === path)?.title ?? path;
}

function parseAmount(text: string, decimals: number): bigint | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const digits = `${whole ?? "0"}${frac.padEnd(decimals, "0")}`;
  const value = BigInt(digits);
  return value > 0n ? value : null;
}

function sampleTimestamps(decaySecs: number): number[] {
  const points: number[] = [];
  const seen = new Set<number>();
  const last = SAMPLE_COUNT - 1;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    let ts = Math.round((decaySecs * i) / last);
    while (seen.has(ts)) ts += 1;
    seen.add(ts);
    points.push(ts);
  }
  return points;
}

function signedBps(bps: number): string {
  return bps > 0 ? `+${bps}` : String(bps);
}

function previewCurve(presetId: PresetId): { curve: CurveChartVM; hardMinOut: bigint } {
  const preset = presets[presetId];
  const hardMinOut = (OFFLINE_ABSOLUTE_BASE * BigInt(preset.hardFloorRatioBps)) / 10_000n;
  const timestamps = sampleTimestamps(preset.decaySecs);
  const outputs = requiredOutputsAt(
    {
      mode: 0,
      baseOut: OFFLINE_ABSOLUTE_BASE,
      startBps: preset.startBps,
      floorBps: preset.floorBps,
      startTime: 0,
      decaySecs: preset.decaySecs,
      hardMinOut,
    },
    timestamps,
    0n,
  );
  const requiredOut = outputs.flatMap((value, index) => {
    const tSec = timestamps[index];
    if (tSec === undefined) return [];
    return [{ tSec, value: formatUnitsFixed(value, BUY_DECIMALS, 4) }];
  });
  return {
    hardMinOut,
    curve: {
      requiredOut,
      poolQuote: { label: "Pool", value: "unavailable" },
      twap: { label: "TWAP", value: "unavailable" },
      hardFloor: { label: "Floor", value: formatUnitsFixed(hardMinOut, BUY_DECIMALS, 4) },
      yUnit: buySymbol,
      empty: requiredOut.length === 0,
    },
  };
}

export default function TradePage() {
  const [amountIn, setAmountIn] = useState("1");
  const [preset, setPreset] = useState<PresetId>("balanced");
  const [gate, setGate] = useState<GateId>("open");
  const [namedLabels, setNamedLabels] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [signingPreview, setSigningPreview] = useState<string | null>(null);
  const preview = useMemo(() => previewCurve(preset), [preset]);
  const amount = parseAmount(amountIn, SELL_DECIMALS);
  const namedMissing = gate === "named" && namedLabels.trim() === "";
  const validationMessages = [
    ...(formError ? [formError] : []),
    ...(namedMissing ? ["Enter the named solver labels."] : []),
    ...(signingPreview ? [signingPreview] : []),
  ];

  function onChange(patch: IntentComposerPatch) {
    setSigningPreview(null);
    if (patch.amountIn !== undefined) setAmountIn(patch.amountIn);
    if (patch.preset !== undefined) setPreset(patch.preset);
    if (patch.gate !== undefined) setGate(patch.gate);
    if (patch.namedLabels !== undefined) setNamedLabels(patch.namedLabels);
    if (patch.mode === "pegged") {
      setFormError("Pegged mode needs a live pool quote. That quote is unavailable.");
      return;
    }
    if (patch.mode === "absolute") setFormError(null);
  }

  function onSubmit() {
    if (amount === null) {
      setFormError(`Enter an amount of ${sellSymbol}.`);
      setSigningPreview(null);
      return;
    }
    if (namedMissing) {
      setFormError(null);
      setSigningPreview(null);
      return;
    }
    const row = presets[preset];
    const deadline = Math.floor(Date.now() / 1000) + row.decaySecs + row.deadlineBufferSecs;
    const summary = signingSummary({
      amountIn: amount,
      hardMinOut: preview.hardMinOut,
      deadline,
      sellSymbol,
      buySymbol,
      sellDecimals: SELL_DECIMALS,
      buyDecimals: BUY_DECIMALS,
    });
    setFormError(null);
    setSigningPreview(
      `Not signed or published. ${summary} A live quote, an on-device wallet, and Arkiv are required before this intent can be committed.`,
    );
  }

  const selected = presets[preset];
  const mode: CurveModeId = "absolute";
  const vm: IntentComposerVM = {
    sellSymbol,
    buySymbol,
    sellBalance: "unavailable",
    buyBalance: "unavailable",
    amountIn,
    preset,
    presets: (["fast", "balanced", "patient"] as const).map((id) => ({
      id,
      label: id === "fast" ? "Fast" : id === "balanced" ? "Balanced" : "Patient",
      summary: `${presets[id].decaySecs}s, ${signedBps(presets[id].startBps)} to ${signedBps(presets[id].floorBps)} bps`,
    })),
    gate,
    gateOptions: [
      { id: "open", label: "Open", enabled: true },
      { id: "listed", label: "Listed solvers", enabled: true },
      { id: "named", label: "Named solvers", enabled: true },
    ],
    namedLabels,
    mode,
    peggedEnabled: false,
    oracleWindowSec: "60",
    startBps: String(selected.startBps),
    floorBps: String(selected.floorBps),
    hardFloorPercent: (selected.hardFloorRatioBps / 100).toFixed(1),
    poolQuote: "unavailable",
    twap: "unavailable",
    solversOnline: "unavailable",
    presence: { count: "0", pair: PAIR, degraded: true, names: [] },
    preview: preview.curve,
    floorLine: `${preview.curve.hardFloor.value} ${buySymbol} on a 1 ${buySymbol} absolute base`,
    validationMessages,
    canSubmit: amount !== null && !namedMissing,
    submitLabel: "Sign & publish",
    faucetLabel: "Get test tokens",
    canFaucet: false,
    banner: quoteBanner,
    onChange,
    onSubmit,
    onFaucet: () => {
      setFormError("The faucet is unavailable.");
    },
  };

  return (
    <RouteShell title={routeTitle("/")}>
      <IntentComposerView vm={vm} />
      <CurveChartView curve={preview.curve} />
    </RouteShell>
  );
}
