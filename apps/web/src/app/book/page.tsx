"use client";

import { PAIR } from "@rival/arkiv";
import { useState } from "react";
import { BookView } from "../../components/views/BookView.tsx";
import { toBookVM } from "../../data/book.ts";
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

export default function BookPage() {
  const [copied, setCopied] = useState(false);
  const banner: BannerVM = {
    kind: "warn",
    text: copied
      ? "Arkiv is unavailable. The query was copied on this page and was not run."
      : "Arkiv is unavailable. Open intents cannot be loaded.",
  };
  const vm = toBookVM({
    rows: [],
    queryArgs,
    banner,
    onCopyQuery: () => {
      const query = toBookVM({ rows: [], queryArgs }).query;
      void navigator.clipboard?.writeText(query).catch(() => undefined);
      setCopied(true);
    },
  });

  return (
    <RouteShell title={routeTitle("/book")}>
      <BookView vm={vm} />
    </RouteShell>
  );
}
