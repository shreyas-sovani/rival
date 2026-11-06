import type { AuctionStatusVM } from "../../../viewmodels/auction.ts";
import type { BookVM } from "../../../viewmodels/book.ts";
import type { BannerVM, EventVM, PresenceVM, TxLinkVM } from "../../../viewmodels/common.ts";
import type { CurveChartVM } from "../../../viewmodels/curve.ts";
import type { EvidenceVM } from "../../../viewmodels/evidence.ts";
import type { IntentComposerVM } from "../../../viewmodels/intent-composer.ts";
import type { LeaderboardVM } from "../../../viewmodels/leaderboard.ts";
import type { ReceiptVM } from "../../../viewmodels/receipt.ts";
import type { RunSolverVM } from "../../../viewmodels/run-solver.ts";

const noop = () => undefined;

export const txLink: TxLinkVM = {
  chain: "sepolia",
  kind: "tx",
  value: "0xabc",
  href: "/tx/0xabc",
  label: "View transaction",
};

export const presence: PresenceVM = {
  count: "4",
  pair: "tWETH/tUSDC",
  degraded: false,
  names: ["atlas"],
};

export const curve: CurveChartVM = {
  requiredOut: [
    { tSec: 0, value: "10" },
    { tSec: 30, value: "9" },
  ],
  poolQuote: { label: "Pool", value: "10" },
  twap: { label: "TWAP", value: "9.8" },
  hardFloor: { label: "Floor", value: "9" },
  yUnit: "tUSDC",
  empty: false,
};

export const emptyCurve: CurveChartVM = { ...curve, requiredOut: [], empty: true };

export const banner: BannerVM = { kind: "info", text: "Testnet prototype." };
export const errorBanner: BannerVM = { kind: "error", text: "Runner unavailable" };

export const receipt: ReceiptVM = {
  intentHash: "0xintent",
  amountIn: "1",
  amountOut: "10",
  curveBps: "50",
  fairOut: "9.8",
  fairOutAfterFee: "9.7",
  improvementBps: "12",
  elapsed: "20s",
  solverName: "atlas.solvers.rival.eth",
  tx: txLink,
  poolDirectAtSign: "Pool A direct swap at signing time: 9.5",
};

export const event: EventVM = { id: "1", at: "2026-11-06T12:00:00Z", text: "Published", tone: "info", link: txLink };

export const composer: IntentComposerVM = {
  sellSymbol: "tWETH",
  buySymbol: "tUSDC",
  sellBalance: "5",
  buyBalance: "10000",
  amountIn: "1",
  preset: "balanced",
  presets: [{ id: "balanced", label: "Balanced", summary: "middle" }],
  gate: "open",
  gateOptions: [{ id: "open", label: "Open", enabled: true }],
  namedLabels: "",
  mode: "absolute",
  peggedEnabled: true,
  oracleWindowSec: "60",
  startBps: "0",
  floorBps: "100",
  hardFloorPercent: "1",
  poolQuote: "10",
  twap: "9.8",
  solversOnline: "4 solvers online",
  presence,
  preview: curve,
  floorLine: "9",
  validationMessages: [],
  canSubmit: true,
  submitLabel: "Sign & publish",
  faucetLabel: "Get test tokens",
  canFaucet: true,
  walletAddress: "0x52908400098527886e0f7030069857d2e4169ee7",
  signingState: "idle",
  banner,
  onChange: noop,
  onSubmit: noop,
  onFaucet: noop,
};

export const auction: AuctionStatusVM = {
  intentHash: "0xintent",
  phase: "live",
  phaseLabel: "Live auction",
  curve,
  events: [event],
  canCancel: true,
  banner,
  onCancel: noop,
};

export const missingAuction: AuctionStatusVM = { ...auction, phase: "missing", phaseLabel: "Missing", events: [] };

export const leaderboard: LeaderboardVM = {
  empty: false,
  rows: [
    {
      label: "atlas",
      ensName: "atlas.solvers.rival.eth",
      address: "0x52908400098527886e0f7030069857d2e4169ee7",
      fills: "100",
      makers: "20",
      avgImprovement: "12 bps",
      lastFill: "1m ago",
      expiresIn: "10d",
      agent: true,
      role: "solver",
      matchesEns: true,
      strategy: "sprint",
    },
  ],
};

export const emptyLeaderboard: LeaderboardVM = { empty: true, rows: [] };

export const book: BookVM = {
  query: "select * from intents",
  rows: [
    {
      intentHash: "0xintent",
      maker: "0xmaker",
      pair: "tWETH/tUSDC",
      amountIn: "1",
      mode: "absolute",
      gate: "open",
      status: "open",
      deadline: "1h",
      signatureOk: true,
      chainStatus: "open",
    },
  ],
  count: "1",
  page: "1",
  empty: false,
  onCopyQuery: noop,
};

export const emptyBook: BookVM = { ...book, rows: [], empty: true, count: "0" };

export const evidence: EvidenceVM = {
  commit: "abc1234",
  addresses: [{ label: "Settlement", value: "0xsettlement" }],
  hookFlags: "0x1",
  pools: [{ label: "Pool A", value: "0xpool" }],
  ensRoles: [{ label: "parent", value: "rival.eth" }],
  queries: [{ title: "Open intents", query: "select * from intents" }],
  limitations: ["Known limit: reputation can be farmed by self-dealing wallets"],
  onUnlistedFill: noop,
  onForgeRecord: noop,
  unlistedResult: "",
  forgeResult: "",
};

export const runSolver: RunSolverVM = {
  steps: [{ n: "3", title: "Register the name", body: "Register the solver label.", command: "pnpm solver:init --label <name>" }],
  initCommand: "pnpm solver:init --label <name>",
  devCommand: "pnpm solver:dev",
  label: "judge1",
  listed: false,
  presence,
  lastFill: "none",
};
