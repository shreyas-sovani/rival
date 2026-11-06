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
