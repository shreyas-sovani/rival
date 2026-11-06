// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AuctionStatusView } from "./AuctionStatusView.tsx";
import { BookView } from "./BookView.tsx";
import { CurveChartView } from "./CurveChartView.tsx";
import { EvidenceView } from "./EvidenceView.tsx";
import { EventStreamView } from "./EventStreamView.tsx";
import { IntentComposerView } from "./IntentComposerView.tsx";
import { LeaderboardView } from "./LeaderboardView.tsx";
import { PresenceChip } from "./PresenceChip.tsx";
import { ReceiptView } from "./ReceiptView.tsx";
import { RunSolverView } from "./RunSolverView.tsx";
import { StatusBanner } from "./StatusBanner.tsx";
import { TxLink } from "./TxLink.tsx";
import {
  auction,
  book,
  composer,
  curve,
  emptyBook,
  emptyCurve,
  emptyLeaderboard,
  errorBanner,
  event,
  evidence,
  leaderboard,
  missingAuction,
  presence,
  receipt,
  runSolver,
} from "./__fixtures__/views.ts";

afterEach(() => cleanup());

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else found.push(full);
  }
  return found;
}

describe("views", () => {
  it("does not import data, hooks, or wallet", () => {
    const root = join(import.meta.dirname, "..");
    for (const file of filesUnder(root)) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/from ["'][^"']*\/(data|hooks|wallet)\//);
    }
  });

  it("renders each view from its fixture", () => {
    render(createElement(IntentComposerView, { vm: composer }));
    expect(screen.getByText("Sign & publish")).toBeTruthy();
    cleanup();
    render(createElement(CurveChartView, { curve }));
    expect(screen.getByText("0s · 10")).toBeTruthy();
    cleanup();
    render(createElement(CurveChartView, { curve: emptyCurve }));
    expect(screen.getByRole("status").textContent).toContain("No curve");
    cleanup();
    render(createElement(ReceiptView, { receipt }));
    expect(screen.getByText("Pool A direct swap at signing time: 9.5")).toBeTruthy();
    cleanup();
    render(createElement(AuctionStatusView, { vm: auction }));
    expect(screen.getByRole("heading", { name: "Live auction" })).toBeTruthy();
    cleanup();
    render(createElement(AuctionStatusView, { vm: missingAuction }));
    expect(screen.getByText("Missing")).toBeTruthy();
    cleanup();
    render(createElement(LeaderboardView, { vm: leaderboard }));
    expect(screen.getByRole("table", { name: "Leaderboard" })).toBeTruthy();
    cleanup();
    render(createElement(LeaderboardView, { vm: emptyLeaderboard }));
    expect(screen.getByText("No solvers")).toBeTruthy();
    cleanup();
    render(createElement(BookView, { vm: book }));
    expect(screen.getByText("select * from intents")).toBeTruthy();
    cleanup();
    render(createElement(BookView, { vm: emptyBook }));
    expect(screen.getByText("No intents")).toBeTruthy();
    cleanup();
    render(createElement(EventStreamView, { events: [event] }));
    expect(screen.getByText("Published")).toBeTruthy();
    cleanup();
    render(createElement(EventStreamView, { events: [] }));
    expect(screen.getByText("No events")).toBeTruthy();
    cleanup();
    render(createElement(PresenceChip, { presence }));
    expect(screen.getByText("4 solvers online")).toBeTruthy();
    cleanup();
    render(createElement(StatusBanner, { banner: errorBanner }));
    expect(screen.getByRole("alert").textContent).toContain("Runner unavailable");
    cleanup();
    render(createElement(EvidenceView, { vm: evidence }));
    expect(screen.getByRole("heading", { name: "Evidence" })).toBeTruthy();
    cleanup();
    render(createElement(RunSolverView, { vm: runSolver }));
    expect(screen.getByText("pnpm solver:dev")).toBeTruthy();
    cleanup();
    render(createElement(TxLink, { link: receipt.tx }));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/tx/0xabc");
  });
});
