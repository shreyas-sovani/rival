import { bpsToPercentString, formatDuration, relativeTime } from "../lib/format.ts";
import type { BannerVM, TxLinkVM } from "../viewmodels/common.ts";
import type { LeaderboardVM, SolverRowVM } from "../viewmodels/leaderboard.ts";

/** Injected solver row. Registry and ENS fields are already read by the caller. */
export interface SolverSourceRow {
  ensName: string;
  address: string;
  fills: bigint;
  makers: bigint;
  avgImprovementBps: number;
  lastFillUnixMs: number;
  nowUnixMs: number;
  expiresAtUnixMs: number;
  agent: boolean;
  role: SolverRowVM["role"];
  matchesEns: boolean;
  strategy: string;
  label?: string;
}

function ensLink(row: SolverSourceRow): TxLinkVM {
  return {
    chain: "sepolia",
    kind: "address",
    value: row.address,
    href: `https://sepolia.etherscan.io/address/${row.address}`,
    label: row.ensName,
  };
}

function toRow(row: SolverSourceRow): SolverRowVM {
  const remainingSec = Math.trunc((row.expiresAtUnixMs - row.nowUnixMs) / 1000);
  return {
    label: row.label ?? row.ensName,
    ensName: row.ensName,
    ensLink: ensLink(row),
    address: row.address,
    fills: row.fills.toString(),
    makers: row.makers.toString(),
    avgImprovement: bpsToPercentString(row.avgImprovementBps),
    lastFill: relativeTime(row.lastFillUnixMs, row.nowUnixMs),
    expiresIn: formatDuration(remainingSec),
    agent: row.agent,
    role: row.role,
    matchesEns: row.matchesEns,
    strategy: row.strategy,
  };
}

/** Map injected solver rows into `LeaderboardVM`. */
export function toLeaderboardVM(args: { rows: readonly SolverSourceRow[]; banner?: BannerVM }): LeaderboardVM {
  return {
    rows: args.rows.map(toRow),
    empty: args.rows.length === 0,
    ...(args.banner ? { banner: args.banner } : {}),
  };
}
