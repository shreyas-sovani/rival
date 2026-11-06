/** Display amounts are already formatted. Raw pairs are explicit and optional. */

export interface RawAmount {
  value: bigint;
  decimals: number;
}

export type BannerKind = "info" | "warn" | "error" | "success";

export interface BannerVM {
  kind: BannerKind;
  text: string;
  /** Optional button label. Absent when the banner is not actionable. */
  actionLabel?: string;
  onAction?: () => void;
}

export type TxLinkKind = "tx" | "address" | "entity";

export interface TxLinkVM {
  chain: "sepolia" | "rabdi";
  kind: TxLinkKind;
  /** Hash, address, or Arkiv entity key. */
  value: string;
  href: string;
  label: string;
}

export interface PresenceVM {
  /** Live solvers for the selected pair. Arkiv count, or the degraded-feed count when `degraded` is true. */
  count: string;
  pair: string;
  degraded: boolean;
  names: string[];
}

export interface EventVM {
  id: string;
  at: string;
  text: string;
  tone: "info" | "ok" | "warn";
  link?: TxLinkVM;
}
