import type { BannerVM, TxLinkVM } from "./common";

export interface SolverRowVM {
  label: string;
  ensName: string;
  ensLink?: TxLinkVM;
  address: string;
  fills: string;
  makers: string;
  avgImprovement: string;
  lastFill: string;
  /** Latest Filled transaction, when a log was found. */
  lastFillLink?: TxLinkVM;
  /** Registry `isListed`. Absent when the read did not report it. */
  listed?: boolean;
  expiresIn: string;
  agent: boolean;
  role: "solver" | "house" | "bot";
  /** True when ENS text records match registry storage. */
  matchesEns: boolean;
  strategy: string;
}

export interface LeaderboardVM {
  rows: SolverRowVM[];
  empty: boolean;
  banner?: BannerVM;
}
