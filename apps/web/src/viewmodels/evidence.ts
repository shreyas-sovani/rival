import type { BannerVM, TxLinkVM } from "./common";

export interface EvidenceRowVM {
  label: string;
  value: string;
  link?: TxLinkVM;
}

export interface EvidenceVM {
  commit: string;
  addresses: EvidenceRowVM[];
  hookFlags: string;
  pools: EvidenceRowVM[];
  ensRoles: EvidenceRowVM[];
  queries: Array<{ title: string; query: string }>;
  limitations: string[];
  banner?: BannerVM;
  /** Simulated eth_call. The view shows `forgeResult` after the callback resolves it into the VM. */
  onUnlistedFill: () => void;
  onForgeRecord: () => void;
  unlistedResult: string;
  forgeResult: string;
}
