import { hexToString } from "viem";
import { createArkivClients } from "../../arkiv/src/client.ts";
import {
  assertPageSize,
  buildIntentQuery,
  MAX_PAGE_SIZE,
  type IntentQueryArgs,
} from "../../arkiv/src/queries.ts";
import { CHAIN_ID, PERMIT2, rivalDeployment } from "./deployment.ts";
import type { Address, Hex } from "./types.ts";
import { readIntent } from "./verify.ts";
import { verifyWitness } from "./witness.ts";

export interface BookQuery {
  pair?: string;
  status?: "open" | "filled" | "cancelled";
  minAmountIn?: bigint;
  maxAmountIn?: bigint;
  mode?: 0 | 1;
  gate?: 0 | 1 | 2;
  deadlineAfter?: bigint;
  deadlineBefore?: bigint;
}

export interface BookRow {
  intentHash: string;
  maker: string;
  pair: string;
  amountIn: string;
  mode: string;
  gate: string;
  status: string;
  deadline: string;
  signatureOk: boolean;
}

export interface BookResult {
  query: string;
  count: string;
  rows: BookRow[];
}

export interface BookReader {
  query: (query: string, options?: { limit?: number }) => Promise<unknown>;
}

export interface BookDeps {
  client?: BookReader;
  now?: number;
}

function readKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.ARKIV_ACCESS_KEYS_READ;
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  const write = env.ARKIV_ACCESS_KEY_WRITE?.trim();
  return write ? [write] : [];
}

function defaultReader(): BookReader {
  const keys = readKeys();
  if (keys.length === 0) throw new Error("arkiv reader is not configured");
  const writeKey = process.env.ARKIV_ACCESS_KEY_WRITE?.trim();
  return createArkivClients({
    readKeys: keys,
    ...(writeKey ? { writeKey } : {}),
  }).read;
}

function pageEntities(page: unknown): unknown[] {
  if (Array.isArray(page)) return page;
  if (!page || typeof page !== "object") return [];
  const entities = (page as { entities?: unknown }).entities;
  return Array.isArray(entities) ? [...entities] : [];
}

function unwrap(value: unknown): unknown {
  if (value && typeof value === "object" && !(value instanceof Uint8Array) && "value" in value) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function field(entity: unknown, name: string): unknown {
  if (!entity || typeof entity !== "object") return undefined;
  const record = entity as Record<string, unknown>;
  if (record[name] !== undefined) return unwrap(record[name]);
  const attributes = record.$attributes ?? record.attributes;
  if (attributes && typeof attributes === "object" && !Array.isArray(attributes)) {
    const value = (attributes as Record<string, unknown>)[name];
    if (value !== undefined) return unwrap(value);
  }
  return undefined;
}

function decimal(value: unknown): string | undefined {
  if (typeof value === "bigint" && value >= 0n) return value.toString();
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^[0-9]+$/.test(value)) return value;
  return undefined;
}

function integer(value: unknown): number | undefined {
  if (typeof value === "bigint" && value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?[0-9]+$/.test(value)) return Number(value);
  return undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function unix(value: bigint | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} is out of range`);
  return Number(value);
}

/**
 * Same steps as `@rival/arkiv` `queryOpenIntents`: build the canonical query, cap the page at 100, run it.
 * Imported from the query module so the package entry does not load the Arkiv barrel.
 */
async function queryOpenIntents(args: IntentQueryArgs & { now: number; client: BookReader }): Promise<unknown> {
  const limit = args.limit ?? MAX_PAGE_SIZE;
  assertPageSize(limit);
  const query = buildIntentQuery({ ...args, status: args.status ?? "open" });
  return args.client.query(query, { limit });
}

/** Arkiv returns `payload` as UTF-8, raw bytes, or a 0x hex string of those bytes. */
export function payloadText(entity: unknown): string | undefined {
  const payload = field(entity, "payload");
  if (payload instanceof Uint8Array) return new TextDecoder().decode(payload);
  if (typeof payload !== "string" || payload === "") return undefined;
  if (payload.startsWith("{")) return payload;
  if (/^0x[0-9a-fA-F]*$/.test(payload) && payload.length % 2 === 0) {
    try {
      return hexToString(payload as Hex);
    } catch {
      return undefined;
    }
  }
  return payload;
}

/** Same Permit2 witness check `verifyPayload` performs, without loading the intent package barrel. */
async function signatureOk(entity: unknown): Promise<boolean> {
  const text = payloadText(entity);
  if (!text) return false;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return false;
    const body = parsed as { intent?: unknown; signature?: unknown };
    const intent = readIntent(body.intent);
    if (!intent || typeof body.signature !== "string" || !body.signature.startsWith("0x")) return false;
    const deployment = rivalDeployment();
    const verdict = await verifyWitness({
      intent,
      signature: body.signature as Hex,
      permit2: PERMIT2,
      settlement: deployment.settlement,
      chainId: CHAIN_ID,
    });
    return verdict.accept;
  } catch {
    return false;
  }
}

async function rowFromEntity(entity: unknown): Promise<BookRow | undefined> {
  const intentHash = text(field(entity, "intentHash"));
  const maker = text(field(entity, "maker"));
  const pair = text(field(entity, "pair"));
  const amountIn = decimal(field(entity, "amountIn"));
  const mode = integer(field(entity, "mode"));
  const gate = integer(field(entity, "gate"));
  const status = text(field(entity, "status"));
  const deadline = decimal(field(entity, "deadline"));
  if (!intentHash || !maker || !pair || !amountIn || !status || !deadline) return undefined;
  if (mode === undefined || (mode !== 0 && mode !== 1)) return undefined;
  if (gate === undefined || (gate !== 0 && gate !== 1 && gate !== 2)) return undefined;
  if (status !== "open" && status !== "filled" && status !== "cancelled") return undefined;
  return {
    intentHash,
    maker,
    pair,
    amountIn,
    mode: String(mode),
    gate: String(gate),
    status,
    deadline,
    signatureOk: await signatureOk(entity),
  };
}

function queryArgs(query: BookQuery, now: number): IntentQueryArgs {
  const args: IntentQueryArgs = {
    now,
    status: query.status ?? "open",
    sortDeadlineAsc: true,
  };
  if (query.pair !== undefined) args.pair = query.pair;
  if (query.gate !== undefined) args.gate = query.gate;
  const deadlineAfter = unix(query.deadlineAfter, "deadlineAfter");
  if (deadlineAfter !== undefined) args.deadlineAfter = deadlineAfter;
  if (query.minAmountIn !== undefined && query.maxAmountIn !== undefined) {
    args.amountInMin = query.minAmountIn;
    args.amountInMax = query.maxAmountIn;
  }
  return args;
}

function keep(row: BookRow, query: BookQuery): boolean {
  if (query.mode !== undefined && row.mode !== String(query.mode)) return false;
  const amount = BigInt(row.amountIn);
  const deadline = BigInt(row.deadline);
  const ranged = query.minAmountIn !== undefined && query.maxAmountIn !== undefined;
  if (!ranged && query.minAmountIn !== undefined && amount < query.minAmountIn) return false;
  if (!ranged && query.maxAmountIn !== undefined && amount > query.maxAmountIn) return false;
  if (query.deadlineBefore !== undefined && deadline > query.deadlineBefore) return false;
  return true;
}

/** Open book from Arkiv. `query` is the string `queryOpenIntents` sent. */
export async function getBook(query: BookQuery = {}, deps?: BookDeps): Promise<BookResult> {
  const now = deps?.now ?? Math.floor(Date.now() / 1000);
  const args = queryArgs(query, now);
  const client = deps?.client ?? defaultReader();
  let sent = "";
  const recording: BookReader = {
    query: async (text, options) => {
      sent = text;
      return client.query(text, options);
    },
  };
  const page = await queryOpenIntents({ ...args, client: recording, now });
  const rows: BookRow[] = [];
  for (const entity of pageEntities(page)) {
    const row = await rowFromEntity(entity);
    if (row && keep(row, query)) rows.push(row);
  }
  return { query: sent, count: String(rows.length), rows };
}

export interface WatchIntentsOpts {
  pair?: string;
  status?: "open" | "filled" | "cancelled";
}

export interface WatchedIntent {
  intentHash: Hex;
  maker: Address;
  pair: string;
  amountIn: string;
  deadline: string;
  status: string;
  signatureOk: boolean;
}

export interface WatchDeps extends BookDeps {
  readBook?: (query: BookQuery) => Promise<BookResult>;
  intervalMs?: number;
}

function sleep(ms: number): { promise: Promise<void>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
  return {
    promise,
    cancel() {
      if (timer) clearTimeout(timer);
    },
  };
}

/** Poll `getBook`. Breaking the consumer cancels the next wait. */
export async function* watchIntents(opts: WatchIntentsOpts = {}, deps?: WatchDeps): AsyncGenerator<WatchedIntent> {
  const read = deps?.readBook ?? ((query: BookQuery) => getBook(query, deps));
  const intervalMs = deps?.intervalMs ?? 2_000;
  const query: BookQuery = {};
  if (opts.pair !== undefined) query.pair = opts.pair;
  if (opts.status !== undefined) query.status = opts.status;
  let pending: { cancel: () => void } | undefined;
  try {
    while (true) {
      const book = await read(query);
      for (const row of book.rows) {
        yield {
          intentHash: row.intentHash as Hex,
          maker: row.maker as Address,
          pair: row.pair,
          amountIn: row.amountIn,
          deadline: row.deadline,
          status: row.status,
          signatureOk: row.signatureOk,
        };
      }
      const wait = sleep(intervalMs);
      pending = wait;
      await wait.promise;
    }
  } finally {
    pending?.cancel();
  }
}
