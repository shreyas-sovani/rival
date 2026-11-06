"use client";

import { useEffect, useState } from "react";
import { AuctionStatusView } from "../../components/views/AuctionStatusView.tsx";
import { EmptyState } from "../../components/ui/EmptyState.tsx";
import type { AuctionStatusVM } from "../../viewmodels/auction.ts";
import type { BannerVM } from "../../viewmodels/common.ts";
import type { CurveChartVM } from "../../viewmodels/curve.ts";
import { routes } from "../../viewmodels/routes.ts";
import { RouteShell } from "./page.shell.tsx";

const INTENT_HASH = /^0x[0-9a-fA-F]{64}$/;

const emptyCurve: CurveChartVM = {
  requiredOut: [],
  poolQuote: { label: "Pool", value: "unavailable" },
  twap: { label: "TWAP", value: "unavailable" },
  hardFloor: { label: "Floor", value: "unavailable" },
  yUnit: "tUSDC",
  empty: true,
};

const chainBanner: BannerVM = {
  kind: "warn",
  text: "Chain events are unavailable, so this auction cannot load its curve, event stream, or receipt.",
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
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get(routes.find((route) => route.path === "/auction")?.queryKey ?? "h");
    setHash(query ?? "");
  }, []);

  if (hash === null) {
    return (
      <RouteShell title={routeTitle("/auction")}>
        <EmptyState title="Live auction">Reading the intent link.</EmptyState>
      </RouteShell>
    );
  }

  const vm: AuctionStatusVM =
    hash === "" || !INTENT_HASH.test(hash)
      ? missingAuction("Open this page with an intent hash.")
      : {
          intentHash: hash,
          phase: "waiting",
          phaseLabel: "Waiting for chain events",
          curve: emptyCurve,
          events: [],
          canCancel: false,
          banner: chainBanner,
          onCancel: () => undefined,
        };

  return (
    <RouteShell title={routeTitle("/auction")}>
      <AuctionStatusView vm={vm} />
    </RouteShell>
  );
}
