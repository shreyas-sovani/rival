"use client";

import { useEffect, useState } from "react";
import { LeaderboardView } from "../../components/views/LeaderboardView.tsx";
import { EmptyState } from "../../components/ui/EmptyState.tsx";
import { KNOWN_LIMIT } from "../../content/evidence-copy.ts";
import { toLeaderboardVM } from "../../data/leaderboard.ts";
import { readSolverRows } from "../../data/registry.ts";
import type { LeaderboardVM } from "../../viewmodels/leaderboard.ts";
import { routes } from "../../viewmodels/routes.ts";
import { RouteShell } from "./page.shell.tsx";

function routeTitle(path: (typeof routes)[number]["path"]): string {
  return routes.find((route) => route.path === path)?.title ?? path;
}

const unavailable = "Solver registry and ENS reads are unavailable.";

export default function SolversPage() {
  const [vm, setVm] = useState<LeaderboardVM | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      readSolverRows()
        .then((rows) => {
          if (cancelled) return;
          setVm(toLeaderboardVM({ rows, banner: { kind: "info", text: KNOWN_LIMIT } }));
        })
        .catch(() => {
          if (cancelled) return;
          setVm(toLeaderboardVM({ rows: [], banner: { kind: "warn", text: unavailable } }));
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

  return (
    <RouteShell title={routeTitle("/solvers")}>
      {vm ? <LeaderboardView vm={vm} /> : <EmptyState title="Solvers">Reading the registry.</EmptyState>}
    </RouteShell>
  );
}
