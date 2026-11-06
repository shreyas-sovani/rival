"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AuctionStatusView } from "../../components/views/AuctionStatusView.tsx";
import { EmptyState } from "../../components/ui/EmptyState.tsx";
import {
  auctionEvents,
  auctionStatusCopy,
  curveForIntent,
  readAuction,
  receiptFromFill,
  type AuctionSnapshot,
} from "../../data/auction.ts";
import { signCancel } from "../../data/cancel.ts";
import {
  isIntentHash,
  loadPublishedIntent,
  quoteBigint,
  storedToIntent,
  type StoredIntent,
} from "../../data/published-intent.ts";
import { ensForSolver } from "../../data/registry.ts";
import { DEGRADED_BOOK_BANNER, postCancel } from "../../data/runner.ts";
import { browserStorage } from "../../wallet/storage.ts";
import { openBurnerWallet, type UnlockedWallet } from "../../wallet/wallet.ts";
import type { AuctionStatusVM } from "../../viewmodels/auction.ts";
import type { BannerVM } from "../../viewmodels/common.ts";
import type { CurveChartVM } from "../../viewmodels/curve.ts";
import { routes } from "../../viewmodels/routes.ts";
import { RouteShell } from "./page.shell.tsx";

const emptyCurve: CurveChartVM = {
  requiredOut: [],
  poolQuote: { label: "Pool", value: "unavailable" },
  twap: { label: "TWAP", value: "unavailable" },
  hardFloor: { label: "Floor", value: "unavailable" },
  yUnit: "tUSDC",
  empty: true,
};

function routeTitle(path: (typeof routes)[number]["path"]): string {
  return routes.find((route) => route.path === path)?.title ?? path;
}

function missingAuction(phaseLabel: string): AuctionStatusVM {
  return {
    intentHash: "",
    phase: "missing",
    phaseLabel,
    curve: emptyCurve,
    events: [],
    canCancel: false,
    onCancel: () => undefined,
  };
}

export default function AuctionPage() {
  const storage = useMemo(() => browserStorage(), []);
  const [hash, setHash] = useState<string | null>(null);
  const [wallet, setWallet] = useState<UnlockedWallet | null>(null);
  const [lookup, setLookup] = useState<{ status: "pending" } | { status: "absent" } | { status: "present"; record: StoredIntent }>({
    status: "pending",
  });
  const [snap, setSnap] = useState<AuctionSnapshot | null>(null);
  const [solverName, setSolverName] = useState("");
  const [chainError, setChainError] = useState<string | null>(null);
  const [localPhase, setLocalPhase] = useState<"cancelled" | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const stopped = useRef(false);
  const timerRef = useRef(0);
  const deadlineRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get(routes.find((route) => route.path === "/auction")?.queryKey ?? "h");
    setHash(query ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    openBurnerWallet(storage)
      .then((next) => {
        if (!cancelled) setWallet(next);
      })
      .catch(() => {
        if (!cancelled) setWallet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (!hash || !isIntentHash(hash)) {
      setLookup({ status: "pending" });
      return;
    }
    let cancelled = false;
    setLookup({ status: "pending" });
    loadPublishedIntent(storage, hash)
      .then((next) => {
        if (cancelled) return;
        setLookup(next ? { status: "present", record: next } : { status: "absent" });
      })
      .catch(() => {
        if (!cancelled) setLookup({ status: "absent" });
      });
    return () => {
      cancelled = true;
    };
  }, [hash, storage]);

  useEffect(() => {
    if (!hash || !isIntentHash(hash)) return;
    stopped.current = false;
    setLocalPhase(null);
    setSnap(null);
    let cancelled = false;
    let timer = 0;
    const tick = async () => {
      if (cancelled || stopped.current || document.visibilityState === "hidden") return;
      try {
        const next = await readAuction(hash, deadlineRef.current);
        if (cancelled || stopped.current) return;
        setSnap(next);
        setChainError(null);
        if (next.phase === "filled" || next.phase === "cancelled" || next.phase === "expired") {
          stopped.current = true;
          window.clearInterval(timer);
        }
      } catch {
        if (!cancelled) setChainError("Chain events are unavailable.");
      }
    };
    void tick();
    timer = window.setInterval(() => {
      void tick();
    }, 4_000);
    timerRef.current = timer;
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hash]);

  useEffect(() => {
    const solver = snap?.fill?.solver;
    if (!solver) {
      setSolverName("");
      return;
    }
    let cancelled = false;
    ensForSolver(solver)
      .then((ens) => {
        if (!cancelled) setSolverName(ens.ensName);
      })
      .catch(() => {
        if (!cancelled) setSolverName("");
      });
    return () => {
      cancelled = true;
    };
  }, [snap?.fill?.solver]);

  if (hash === null) {
    return (
      <RouteShell title={routeTitle("/auction")}>
        <EmptyState title="Live auction">Reading the intent link.</EmptyState>
      </RouteShell>
    );
  }

  if (hash === "" || !isIntentHash(hash)) {
    const missing = auctionStatusCopy({
      hashValid: false,
      hasStoredIntent: false,
      phase: "waiting",
      curveEmpty: true,
    });
    return (
      <RouteShell title={routeTitle("/auction")}>
        <AuctionStatusView vm={missingAuction(missing.phaseLabel)} />
      </RouteShell>
    );
  }

  if (lookup.status === "pending") {
    return (
      <RouteShell title={routeTitle("/auction")}>
        <EmptyState title="Live auction">Reading the intent link.</EmptyState>
      </RouteShell>
    );
  }

  const record = lookup.status === "present" ? lookup.record : null;
  const hasStoredIntent = lookup.status === "present";
  const intent = record ? storedToIntent(record) : null;
  deadlineRef.current = record?.intent.deadline;
  const poolOut = record ? quoteBigint(record.poolOut) : null;
  const twapOut = record ? quoteBigint(record.twapOut) : null;
  const quoteOut = intent?.mode === 1 ? twapOut : 0n;
  const curve =
    intent && (intent.mode === 0 || quoteOut !== null)
      ? curveForIntent({
          intent,
          quoteOut: quoteOut ?? 0n,
          poolOut,
          twapOut,
          ...(snap?.fill
            ? {
                fill: {
                  tSec: snap.fill.elapsed,
                  value: receiptFromFill({
                    fill: snap.fill,
                    intent,
                    quoteOut: quoteOut ?? 0n,
                    poolDirectAtSign: record?.poolDirectAtSign ?? "Pool A direct swap at signing time: unavailable",
                  }).amountOut,
                },
              }
            : {}),
        })
      : emptyCurve;
  const phase = localPhase ?? snap?.phase ?? "waiting";
  const statusCopy = auctionStatusCopy({
    hashValid: true,
    hasStoredIntent,
    phase,
    curveEmpty: curve.empty,
  });
  const makerMatches = Boolean(wallet && intent && wallet.address.toLowerCase() === intent.maker.toLowerCase());
  const filledWithoutLog = phase === "filled" && !snap?.fill;
  const banner = auctionBanner({
    cancelError,
    filledWithoutLog,
    chainError,
    hasCurve: !curve.empty,
    degraded: record?.degraded === true,
    ...(statusCopy.banner ? { noLocalBanner: statusCopy.banner } : {}),
  });
  const receipt =
    snap?.fill && phase === "filled"
      ? receiptFromFill({
          fill: snap.fill,
          ...(intent ? { intent, quoteOut: quoteOut ?? 0n } : {}),
          poolDirectAtSign: record?.poolDirectAtSign ?? "Pool A direct swap at signing time: unavailable",
          ...(record?.entityKey ? { entityKey: record.entityKey } : {}),
          ...(solverName ? { solverName } : {}),
        })
      : undefined;
  const vm: AuctionStatusVM = {
    intentHash: hash,
    phase: phase === "waiting" ? (hasStoredIntent ? "live" : "waiting") : phase,
    phaseLabel: statusCopy.phaseLabel,
    curve,
    events: auctionEvents({
      ...(record ? { publishedAt: new Date(record.intent.startTime * 1000).toISOString(), ...(record.entityKey ? { entityKey: record.entityKey } : {}) } : {}),
      ...(snap?.fill ? { fill: snap.fill } : {}),
      ...(snap?.cancelTx ? { cancelTx: snap.cancelTx } : {}),
      expired: phase === "expired",
    }),
    ...(receipt ? { receipt } : {}),
    canCancel: phase === "waiting" && makerMatches && !cancelling,
    ...(banner ? { banner } : {}),
    onCancel: () => {
      if (!wallet || !isIntentHash(hash) || cancelling) return;
      const intentHash = hash;
      setCancelling(true);
      setCancelError(null);
      const deadline = Math.floor(Date.now() / 1000) + 600;
      void signCancel(wallet.account, intentHash, deadline)
        .then((signature) => postCancel({ intentHash, deadline, signature }))
        .then(() => {
          stopped.current = true;
          window.clearInterval(timerRef.current);
          setLocalPhase("cancelled");
        })
        .catch((err: unknown) => {
          setCancelError(err instanceof Error ? err.message : "Cancel failed.");
        })
        .finally(() => {
          setCancelling(false);
        });
    },
  };

  return (
    <RouteShell title={routeTitle("/auction")}>
      <AuctionStatusView vm={vm} />
    </RouteShell>
  );
}

function auctionBanner(args: {
  cancelError: string | null;
  filledWithoutLog: boolean;
  chainError: string | null;
  hasCurve: boolean;
  degraded: boolean;
  noLocalBanner?: string;
}): BannerVM | undefined {
  if (args.cancelError) return { kind: "error", text: args.cancelError };
  if (args.filledWithoutLog) {
    return {
      kind: "warn",
      text: "Filled on chain, but the Filled log was not returned, so there is no receipt.",
    };
  }
  if (args.noLocalBanner) return { kind: "info", text: args.noLocalBanner };
  if (args.chainError) {
    return {
      kind: "warn",
      text: args.hasCurve
        ? "Chain events are unavailable. The curve is the signed intent. No receipt is shown."
        : "Chain events are unavailable, so this auction cannot load its curve, event stream, or receipt.",
    };
  }
  if (args.degraded) return { kind: "warn", text: DEGRADED_BOOK_BANNER };
  if (!args.hasCurve) {
    return {
      kind: "info",
      text: "This browser does not have the signed curve for this intent. Chain events are still being read.",
    };
  }
  return undefined;
}
