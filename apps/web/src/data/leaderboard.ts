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
  listed?: boolean;
  lastFillTx?: string;
  lastFillLabel?: string;
  expiresLabel?: string;
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

function lastFillLink(tx: string): TxLinkVM {
  return {
    chain: "sepolia",
    kind: "tx",
    value: tx,
    href: `https://sepolia.etherscan.io/tx/${tx}`,
    label: "View transaction",
  };
}

function toRow(row: SolverSourceRow): SolverRowVM {
  const remainingSec = Math.trunc((row.expiresAtUnixMs - row.nowUnixMs) / 1000);
  return {
    label: row.label ?? row.ensName,
    ensName: row.ensName,
    ...(row.ensName ? { ensLink: ensLink(row) } : {}),
    address: row.address,
    fills: row.fills.toString(),
    makers: row.makers.toString(),
    avgImprovement: bpsToPercentString(row.avgImprovementBps),
    lastFill: row.lastFillLabel ?? relativeTime(row.lastFillUnixMs, row.nowUnixMs),
    ...(row.lastFillTx ? { lastFillLink: lastFillLink(row.lastFillTx) } : {}),
    ...(row.listed === undefined ? {} : { listed: row.listed }),
    expiresIn: row.expiresLabel ?? formatDuration(remainingSec),
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
