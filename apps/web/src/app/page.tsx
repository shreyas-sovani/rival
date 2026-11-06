"use client";

import { buildIntent, hashIntent, presets, type PresetId } from "@rival/intent";
import { PAIR } from "@rival/arkiv";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { keccak256, toBytes, type Hex } from "viem";
import { IntentComposerView } from "../components/views/IntentComposerView.tsx";
import { mapFaucetClaimError, signFaucetClaim, utcDay } from "../data/faucet.ts";
import { quoteSell, readBalances, readLiveMarket, type LiveMarket } from "../data/live-market.ts";
import { publicDeployment } from "../data/public-deployment.ts";
import { recordFromIntent, savePublishedIntent } from "../data/published-intent.ts";
import {
  CHAIN_ID,
  DEGRADED_BOOK_BANNER,
  PERMIT2,
  faucetIsStocked,
  fetchOpenBook,
  postFaucet,
  postSignedIntent,
  previewCurve,
  readHealth,
  runnerOrigin,
  sellBalanceAllowsSubmit,
  sellBalanceBlockMessage,
  settlementAddress,
  type BookFeed,
} from "../data/runner.ts";
import { signingSummary, signIntent } from "../data/signing.ts";
import { formatUnitsFixed } from "../lib/format.ts";
import { browserStorage } from "../wallet/storage.ts";
import { openBurnerWallet, type UnlockedWallet } from "../wallet/wallet.ts";
import type { BannerVM } from "../viewmodels/common.ts";
import type { CurveModeId, GateId, IntentComposerPatch, IntentComposerVM, SigningState } from "../viewmodels/intent-composer.ts";
import { routes } from "../viewmodels/routes.ts";
import { RouteShell } from "./page.shell.tsx";

const SELL_DECIMALS = 18;
const BUY_DECIMALS = 6;

const pairParts = PAIR.split("/");
const sellSymbol = pairParts[0] ?? "tWETH";
const buySymbol = pairParts[1] ?? "tUSDC";

const OFFLINE_BANNER: BannerVM = {
  kind: "warn",
  text: "Live pool quote and TWAP are unavailable, so pegged mode is off. No pool price is shown.",
};

const LIVE_TEXT =
  "Pool A spot and the 60-second hook TWAP are live Sepolia reads. The floor is 98.5% of that quote. Pegged mode uses the TWAP.";

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

function signedBps(bps: number): string {
  return bps > 0 ? `+${bps}` : String(bps);
}

function randomNonce(): bigint {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  return value === 0n ? 1n : value;
}

function allowLabels(text: string): Hex[] {
  return text
    .split(/[\s,]+/)
    .filter((label) => label !== "")
    .map((label) => keccak256(toBytes(label.toLowerCase())));
}

function heldBalances(next: { sell: bigint; buy: bigint }): { sell: string; buy: string; sellRaw: bigint } {
  return {
    sell: formatUnitsFixed(next.sell, SELL_DECIMALS, 4),
    buy: formatUnitsFixed(next.buy, BUY_DECIMALS, 4),
    sellRaw: next.sell,
  };
}

async function paintSummary(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export default function TradePage() {
  const router = useRouter();
  const storage = useMemo(() => browserStorage(), []);
  const [amountIn, setAmountIn] = useState("1");
  const [preset, setPreset] = useState<PresetId>("balanced");
  const [gate, setGate] = useState<GateId>("open");
  const [namedLabels, setNamedLabels] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [signingPreview, setSigningPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<CurveModeId>("absolute");
  const [market, setMarket] = useState<LiveMarket | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ sell: string; buy: string; sellRaw: bigint } | null>(null);
  const [wallet, setWallet] = useState<UnlockedWallet | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [signingState, setSigningState] = useState<SigningState>("idle");
  const [published, setPublished] = useState<IntentComposerVM["published"]>(undefined);
  const [feed, setFeed] = useState<BookFeed | null>(null);
  const [feedError, setFeedError] = useState(false);
  const [health, setHealth] = useState<unknown>(null);
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [forcedDegraded, setForcedDegraded] = useState(false);
  const submitting = useRef(false);
  const amount = parseAmount(amountIn, SELL_DECIMALS);
  const quotedAmount = amount ?? 10n ** BigInt(SELL_DECIMALS);
  const quotes = useMemo(() => {
    if (!market) return { poolOut: null as bigint | null, twapOut: null as bigint | null };
    try {
      return {
        poolOut: quoteSell(market.spotTick, quotedAmount),
        twapOut: quoteSell(market.twapTick, quotedAmount),
      };
    } catch {
      return { poolOut: null as bigint | null, twapOut: null as bigint | null };
    }
  }, [market, quotedAmount]);
  const activeMode: CurveModeId = mode === "pegged" && quotes.twapOut === null ? "absolute" : mode;
  const preview = useMemo(
    () => previewCurve(preset, activeMode, quotes.poolOut, quotes.twapOut),
    [preset, activeMode, quotes.poolOut, quotes.twapOut],
  );

  useEffect(() => {
    let cancelled = false;
    openBurnerWallet(storage)
      .then((next) => {
        if (!cancelled) setWallet(next);
      })
      .catch(() => {
        if (!cancelled) setWalletError("The on-device wallet could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      readBalances(wallet.address)
        .then((next) => {
          if (cancelled) return;
          setBalances(heldBalances(next));
        })
        .catch(() => {
          if (!cancelled) setBalances(null);
        });
    };
    tick();
    const timer = window.setInterval(tick, 15_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [wallet]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      readLiveMarket()
        .then((next) => {
          if (!cancelled) {
            setMarket(next);
            setMarketError(null);
          }
        })
        .catch(() => {
          if (!cancelled) setMarketError("The Sepolia pool read failed.");
        });
    };
    tick();
    const timer = window.setInterval(tick, 15_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      fetchOpenBook()
        .then((next) => {
          if (cancelled) return;
          setFeed(next);
          setFeedError(false);
        })
        .catch(() => {
          if (!cancelled) setFeedError(true);
        });
      readHealth()
        .then((next) => {
          if (!cancelled) setHealth(next);
        })
        .catch(() => {
          if (!cancelled) setHealth(null);
        });
    };
    tick();
    const timer = window.setInterval(tick, 10_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const namedMissing = gate === "named" && namedLabels.trim() === "";
  const needTokens = sellBalanceBlockMessage(wallet !== null && balances !== null ? balances.sellRaw : null, amount);
  const validationMessages = [
    ...(walletError ? [walletError] : []),
    ...(formError && formError !== "Get test tokens first" ? [formError] : []),
    ...(needTokens ? [needTokens] : []),
    ...(namedMissing ? ["Enter the named solver labels."] : []),
    ...(signingPreview ? [signingPreview] : []),
  ];
  const busy = signingState === "signing" || signingState === "publishing";
  const reference = activeMode === "pegged" ? quotes.twapOut : quotes.poolOut;
  const stocked = health !== null && faucetIsStocked(health);

  function onChange(patch: IntentComposerPatch) {
    if (!busy) {
      setSigningPreview(null);
      setSigningState("idle");
    }
    if (patch.amountIn !== undefined) setAmountIn(patch.amountIn);
    if (patch.preset !== undefined) setPreset(patch.preset);
    if (patch.gate !== undefined) setGate(patch.gate);
    if (patch.namedLabels !== undefined) setNamedLabels(patch.namedLabels);
    if (patch.mode === "pegged") {
      if (quotes.twapOut === null) {
        setFormError("Pegged mode needs a live TWAP. That quote is unavailable.");
        return;
      }
      setMode("pegged");
      setFormError(null);
      return;
    }
    if (patch.mode === "absolute") {
      setMode("absolute");
      setFormError(null);
    }
  }

  async function onSubmit() {
    if (busy || submitting.current) return;
    submitting.current = true;
    if (!wallet) {
      submitting.current = false;
      setFormError(walletError ?? "The on-device wallet is not ready.");
      return;
    }
    if (amount === null) {
      submitting.current = false;
      setFormError(`Enter an amount of ${sellSymbol}.`);
      setSigningPreview(null);
      return;
    }
    if (!sellBalanceAllowsSubmit(balances?.sellRaw ?? null, amount)) {
      submitting.current = false;
      setSigningPreview(null);
      const block = sellBalanceBlockMessage(balances?.sellRaw ?? null, amount);
      if (block) setFormError(block);
      return;
    }
    if (namedMissing) {
      submitting.current = false;
      setFormError(null);
      setSigningPreview(null);
      return;
    }
    if (reference === null) {
      submitting.current = false;
      setFormError("A live quote is required before this intent can be signed.");
      setSigningPreview(null);
      return;
    }
    const row = presets[preset];
    const startTime = Math.floor(Date.now() / 1000);
    const deadline = startTime + row.decaySecs + row.deadlineBufferSecs;
    const hardMinOut = preview.hardMinOut;
    const summary = signingSummary({
      amountIn: amount,
      hardMinOut,
      deadline,
      sellSymbol,
      buySymbol,
      sellDecimals: SELL_DECIMALS,
      buyDecimals: BUY_DECIMALS,
    });
    setFormError(null);
    setSigningPreview(summary);
    setSigningState("signing");
    await paintSummary();
    try {
      const intent = buildIntent({
        maker: wallet.address,
        tokenIn: publicDeployment.tokens.tWETH as Hex,
        tokenOut: publicDeployment.tokens.tUSDC as Hex,
        amountIn: amount,
        preset,
        mode: activeMode === "pegged" ? 1 : 0,
        baseOut: activeMode === "pegged" ? 0n : reference,
        oracleWindow: activeMode === "pegged" ? 60 : 0,
        startTime,
        deadline,
        hardMinOut,
        gate: gate === "named" ? 2 : gate === "listed" ? 1 : 0,
        allowLabels: gate === "named" ? allowLabels(namedLabels) : [],
        nonce: randomNonce(),
      });
      const signed = await signIntent({
        account: wallet.account,
        intent,
        permit2: PERMIT2,
        settlement: settlementAddress(),
        chainId: CHAIN_ID,
        sellSymbol,
        buySymbol,
        sellDecimals: SELL_DECIMALS,
        buyDecimals: BUY_DECIMALS,
      });
      setSigningState("publishing");
      const result = await postSignedIntent({
        endpoint: `${runnerOrigin()}/api/intents`,
        intent,
        signature: signed.signature,
        wallet,
      });
      const localHash = hashIntent(intent, {
        name: "RivalSettlement",
        version: "1",
        chainId: CHAIN_ID,
        verifyingContract: settlementAddress(),
      });
      const intentHash = result.intentHash || localHash;
      await savePublishedIntent(
        storage,
        intentHash,
        recordFromIntent({
          intent,
          poolOut: quotes.poolOut,
          twapOut: quotes.twapOut,
          poolDirectAtSign:
            quotes.poolOut === null
              ? "Pool A direct swap at signing time: unavailable"
              : `Pool A direct swap at signing time: ${formatUnitsFixed(quotes.poolOut, BUY_DECIMALS, 4)} ${buySymbol}`,
          ...(result.entityKey ? { entityKey: result.entityKey } : {}),
          degraded: result.degraded,
        }),
      );
      const redirect = `/auction?h=${intentHash}`;
      setPublished({
        intentHash,
        ...(result.entityKey ? { entityKey: result.entityKey } : {}),
        redirect,
      });
      setSigningState("published");
      if (result.degraded) setForcedDegraded(true);
      router.push(redirect);
    } catch (err) {
      submitting.current = false;
      setSigningState("failed");
      setFormError(err instanceof Error ? err.message : "The intent was not published.");
    }
  }

  async function onFaucet() {
    if (!wallet || faucetBusy || !stocked) return;
    setFaucetBusy(true);
    setFormError(null);
    try {
      const day = utcDay();
      const signature = await signFaucetClaim({ account: wallet.account, day, kind: "tokens" });
      await postFaucet({ wallet: wallet.address, signature, day, kind: "tokens" });
      const next = await readBalances(wallet.address);
      setBalances(heldBalances(next));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "The faucet claim failed.";
      setFormError(mapFaucetClaimError(raw));
    } finally {
      setFaucetBusy(false);
    }
  }

  const live = quotes.poolOut !== null && quotes.twapOut !== null;
  const quoteText = (value: bigint | null) =>
    value === null ? (marketError ? "unavailable" : "") : `${formatUnitsFixed(value, BUY_DECIMALS, 4)} ${buySymbol}`;
  const degraded = forcedDegraded || feed?.source === "degraded";
  const banner: BannerVM = degraded
    ? { kind: "warn", text: DEGRADED_BOOK_BANNER }
    : live
      ? { kind: "info", text: LIVE_TEXT }
      : marketError
        ? OFFLINE_BANNER
        : { kind: "info", text: "Reading Sepolia pool A." };
  const vm: IntentComposerVM = {
    sellSymbol,
    buySymbol,
    sellBalance: wallet ? (balances?.sell ?? "unavailable") : "no wallet",
    buyBalance: wallet ? (balances?.buy ?? "unavailable") : "no wallet",
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
    mode: activeMode,
    peggedEnabled: quotes.twapOut !== null,
    oracleWindowSec: "60",
    startBps: String(presets[preset].startBps),
    floorBps: String(presets[preset].floorBps),
    hardFloorPercent: (presets[preset].hardFloorRatioBps / 100).toFixed(1),
    poolQuote: quoteText(quotes.poolOut),
    twap: quoteText(quotes.twapOut),
    solversOnline: feed ? (degraded ? "degraded feed" : `${feed.presence} solvers online`) : feedError ? "unavailable" : "",
    presence: {
      count: feed ? String(feed.presence) : feedError ? "unavailable" : "…",
      pair: PAIR,
      degraded: degraded || feedError,
      names: [],
    },
    preview: preview.curve,
    floorLine:
      reference !== null
        ? `${preview.curve.hardFloor.value} ${buySymbol} on ${amountIn || "1"} ${sellSymbol} at the ${activeMode} quote`
        : "unavailable",
    validationMessages,
    canSubmit:
      amount !== null &&
      !namedMissing &&
      wallet !== null &&
      reference !== null &&
      !busy &&
      sellBalanceAllowsSubmit(balances?.sellRaw ?? null, amount),
    submitLabel:
      signingState === "signing" ? "Signing…" : signingState === "publishing" ? "Publishing…" : signingState === "published" ? "Published" : "Sign & publish",
    faucetLabel: faucetBusy ? "Claiming…" : "Get test tokens",
    canFaucet: wallet !== null && stocked && !faucetBusy,
    walletAddress: wallet?.address ?? "",
    signingState,
    ...(published ? { published } : {}),
    banner,
    onChange,
    onSubmit: () => {
      void onSubmit();
    },
    onFaucet: () => {
      void onFaucet();
    },
  };

  return (
    <RouteShell title={routeTitle("/")}>
      <IntentComposerView vm={vm} />
    </RouteShell>
  );
}
