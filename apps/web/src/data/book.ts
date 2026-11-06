import { buildIntentQuery, type IntentQueryArgs } from "@rival/arkiv";
import { formatUnitsFixed, shortHex } from "../lib/format.ts";
import type { BookRowVM, BookVM } from "../viewmodels/book.ts";
import type { BannerVM, TxLinkVM } from "../viewmodels/common.ts";

/** One injected Arkiv intent row. Amounts stay in base units until the adapter formats them. */
export interface BookSourceRow {
  intentHash: string;
  maker: string;
  pair: string;
  amountIn: bigint;
  amountDecimals?: number;
  mode: number;
  gate: number;
  status: string;
  deadline: number | bigint;
  signatureOk: boolean;
  chainStatus: string;
  fillTx?: string;
  entityKey?: string;
  /** Raw floor from the feed. Displayed as sent. */
  floor?: string;
  /** Overrides the absolute UTC deadline when the page wants a countdown. */
  deadlineLabel?: string;
}

function modeLabel(mode: number): string {
  if (mode === 0) return "absolute";
  if (mode === 1) return "pegged";
  return String(mode);
}

function gateLabel(gate: number): string {
  if (gate === 0) return "open";
  if (gate === 1) return "listed";
  if (gate === 2) return "named";
  return String(gate);
}

function formatDeadline(deadline: number | bigint): string {
  const unixSeconds = typeof deadline === "bigint" ? Number(deadline) : deadline;
  const date = new Date(unixSeconds * 1000);
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}-${mo}-${day} ${hh}:${mm}:${ss} UTC`;
}

function fillLink(fillTx: string): TxLinkVM {
  return {
    chain: "sepolia",
    kind: "tx",
    value: fillTx,
    href: `https://sepolia.etherscan.io/tx/${fillTx}`,
    label: shortHex(fillTx),
  };
}

function entityLink(entityKey: string): TxLinkVM {
  return {
    chain: "rabdi",
    kind: "entity",
    value: entityKey,
    href: `https://rabdi.explorer.arkiv.network/entity/${entityKey}`,
    label: "View entity",
  };
}

function toRow(row: BookSourceRow): BookRowVM {
  return {
    intentHash: row.intentHash,
    maker: row.maker,
    pair: row.pair,
    amountIn: formatUnitsFixed(row.amountIn, row.amountDecimals ?? 18, 4),
    mode: modeLabel(row.mode),
    gate: gateLabel(row.gate),
    status: row.status,
    deadline: row.deadlineLabel ?? formatDeadline(row.deadline),
    signatureOk: row.signatureOk,
    chainStatus: row.chainStatus,
    ...(row.floor ? { floor: row.floor } : {}),
    ...(row.fillTx ? { fillLink: fillLink(row.fillTx) } : {}),
    ...(row.entityKey ? { entityLink: entityLink(row.entityKey) } : {}),
  };
}

/** Where the book rows came from. Absent until the page has a feed. */
export type BookFeedSource = "arkiv" | "degraded";

function emptyTitleFor(source: BookFeedSource | undefined): string {
  if (source === "arkiv") return "no open intents";
  return "No intents";
}

/** Map injected book rows into `BookVM`. The query string comes from `@rival/arkiv`. */
export function toBookVM(args: {
  rows: readonly BookSourceRow[];
  queryArgs: IntentQueryArgs;
  page?: number;
  onCopyQuery?: () => void;
  banner?: BannerVM;
  source?: BookFeedSource;
}): BookVM {
  const rows = args.rows.map(toRow);
  const empty = rows.length === 0;
  return {
    query: buildIntentQuery(args.queryArgs),
    rows,
    count: String(rows.length),
    page: String(args.page ?? 1),
    empty,
    ...(empty ? { emptyTitle: emptyTitleFor(args.source) } : {}),
    ...(args.banner ? { banner: args.banner } : {}),
    onCopyQuery: args.onCopyQuery ?? (() => {}),
  };
}
