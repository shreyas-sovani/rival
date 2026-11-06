"use client";

import { PAIR } from "@rival/arkiv";
import { useEffect, useState } from "react";
import { BookView } from "../../components/views/BookView.tsx";
import { toBookVM, type BookSourceRow } from "../../data/book.ts";
import { DEGRADED_BOOK_BANNER, fetchOpenBook, type BookFeed } from "../../data/runner.ts";
import { formatDuration } from "../../lib/format.ts";
import type { BannerVM } from "../../viewmodels/common.ts";
import { routes } from "../../viewmodels/routes.ts";
import { RouteShell } from "./page.shell.tsx";

const queryArgs = {
  status: "open",
  pair: PAIR,
  sortDeadlineAsc: true,
} as const;

function routeTitle(path: (typeof routes)[number]["path"]): string {
  return routes.find((route) => route.path === path)?.title ?? path;
}

function countdown(deadline: number, nowSec: number): string {
  const remaining = deadline - nowSec;
  if (remaining <= 0) return "expired";
  return formatDuration(remaining);
}

function bannerFor(feed: BookFeed | null, error: string | null): BannerVM | undefined {
  if (feed?.source === "degraded") return { kind: "warn", text: DEGRADED_BOOK_BANNER };
  if (error) return { kind: "warn", text: "Arkiv is unavailable. Open intents cannot be loaded." };
  if (!feed) return { kind: "info", text: "Reading open intents." };
  return undefined;
}

export default function BookPage() {
  const [feed, setFeed] = useState<BookFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      fetchOpenBook()
        .then((next) => {
          if (cancelled) return;
          setFeed(next);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Open intents cannot be loaded.");
        });
    };
    tick();
    const timer = window.setInterval(tick, 10_000);
    const clock = window.setInterval(() => {
      if (document.visibilityState === "visible") setNow(Math.floor(Date.now() / 1000));
    }, 1_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const rows: BookSourceRow[] = (feed?.rows ?? []).map((row) => ({
    ...row,
    deadlineLabel: countdown(typeof row.deadline === "bigint" ? Number(row.deadline) : row.deadline, now),
  }));
  const banner = bannerFor(feed, error);
  const vm = toBookVM({
    rows,
    queryArgs,
    ...(feed ? { source: feed.source } : {}),
    ...(banner ? { banner } : {}),
    onCopyQuery: () => {
      const query = toBookVM({ rows: [], queryArgs }).query;
      void navigator.clipboard?.writeText(query).catch(() => undefined);
    },
  });

  return (
    <RouteShell title={routeTitle("/book")}>
      <BookView vm={vm} />
    </RouteShell>
  );
}
