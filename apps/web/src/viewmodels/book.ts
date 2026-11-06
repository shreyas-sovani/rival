import type { BannerVM, TxLinkVM } from "./common";

export interface BookRowVM {
  intentHash: string;
  maker: string;
  pair: string;
  amountIn: string;
  mode: string;
  gate: string;
  status: string;
  deadline: string;
  signatureOk: boolean;
  chainStatus: string;
  fillLink?: TxLinkVM;
  entityLink?: TxLinkVM;
}

export interface BookVM {
  /** Exact Arkiv query string the page ran. Copyable. */
  query: string;
  rows: BookRowVM[];
  count: string;
  page: string;
  empty: boolean;
  banner?: BannerVM;
  onCopyQuery: () => void;
}
