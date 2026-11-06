/** Stable `data-testid` values for views, primitives, and page objects. */
export const testIds = {
  header: "header",
  nav: "nav",
  disclaimer: "disclaimer",
  footer: "footer",
  intentComposer: "intent-composer",
  curveChart: "curve-chart",
  receipt: "receipt",
  auctionStatus: "auction-status",
  leaderboard: "leaderboard",
  book: "book",
  eventStream: "event-stream",
  presenceChip: "presence-chip",
  statusBanner: "status-banner",
  evidence: "evidence",
  runSolver: "run-solver",
  txLink: "tx-link",
} as const;

export type TestId = (typeof testIds)[keyof typeof testIds];
