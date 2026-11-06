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
  /** Display floor from the book feed, when the row includes one. */
  floor?: string;
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
  /**
   * Heading shown when `empty` is true.
   * A live Arkiv read with zero rows is "no open intents".
   * A degraded feed, or a book that has not loaded, keeps a different title.
   */
  emptyTitle?: string;
  banner?: BannerVM;
  onCopyQuery: () => void;
}
