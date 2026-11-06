import { addr, bytes, defineSchema, i32, str, u256, u64 } from "@arkiv-network/sdk/schema";

/**
 * Arkiv schemas for the public book (PRD §7.4).
 *
 * Limits checked here match Arkiv docs fetched 6 Nov 2026 (`/reference/limits`):
 * attribute names ≤ 32 bytes, named schemas ≤ 31 columns (the `arkiv.schema` tag
 * consumes the 32nd), schema names ≤ 128 bytes. `str` values are ≤ 128 bytes and
 * `bytes` values are ≤ 128 KiB; those are enforced by the SDK at write time.
 * `payload` is additionally capped at 2 KiB by the publisher (FR-ARK-01).
 */

const MAX_NAME_BYTES = 32;
const MAX_COLUMNS = 31;
const MAX_SCHEMA_NAME_BYTES = 128;

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

function assertSchemaShape(name: string, columns: readonly string[]): void {
  if (utf8Length(name) === 0 || utf8Length(name) > MAX_SCHEMA_NAME_BYTES) {
    throw new Error(`schema name must be 1..128 bytes: ${name}`);
  }
  if (columns.length > MAX_COLUMNS) {
    throw new Error(`${name} has ${columns.length} columns; named schemas allow ${MAX_COLUMNS}`);
  }
  const seen = new Set<string>();
  for (const column of columns) {
    if (seen.has(column)) {
      throw new Error(`${name} repeats column ${column}`);
    }
    seen.add(column);
    if (utf8Length(column) === 0 || utf8Length(column) > MAX_NAME_BYTES) {
      throw new Error(`${name}.${column} exceeds ${MAX_NAME_BYTES} bytes`);
    }
  }
}

const intentColumns = [
  "intentHash",
  "maker",
  "pair",
  "tokenIn",
  "tokenOut",
  "amountIn",
  "mode",
  "gate",
  "startTime",
  "deadline",
  "decaySecs",
  "startBps",
  "floorBps",
  "hardMinOut",
  "status",
  "filledBy",
  "fillTx",
  "publisher",
  "payload",
] as const;

const presenceColumns = [
  "solver",
  "ensName",
  "pair",
  "maxAmountIn",
  "strategy",
  "endpoint",
  "version",
] as const;

assertSchemaShape("rival.intent.v1", intentColumns);
assertSchemaShape("rival.solver.v1", presenceColumns);

/** Signed intent on the public book. `status` is advisory; solvers re-check chain state. */
export const IntentEntity = defineSchema("rival.intent.v1", {
  intentHash: str().indexed(),
  maker: addr().indexed(),
  pair: str().indexed(),
  tokenIn: addr().indexed(),
  tokenOut: addr().indexed(),
  amountIn: u256().indexed(),
  mode: i32().indexed(),
  gate: i32().indexed(),
  startTime: u64().indexed(),
  deadline: u64().indexed(),
  decaySecs: i32().indexed(),
  startBps: i32(),
  floorBps: i32(),
  hardMinOut: u256(),
  status: str().indexed(),
  filledBy: addr().optional(),
  fillTx: str().optional(),
  publisher: addr(),
  payload: bytes(),
});

/** One live solver advertisement per (solver, pair). Expires in 3 minutes; the owner extends it. */
export const SolverPresence = defineSchema("rival.solver.v1", {
  solver: addr().indexed(),
  ensName: str().indexed(),
  pair: str().indexed(),
  maxAmountIn: u256(),
  strategy: str(),
  endpoint: str().optional(),
  version: str(),
});

export const INTENT_SCHEMA = "rival.intent.v1" as const;
export const PRESENCE_SCHEMA = "rival.solver.v1" as const;
export const PAIR = "tWETH/tUSDC" as const;

/** Publisher cap on `payload` (JSON `{ intent, signature }`). Below Arkiv's 128 KiB `bytes` limit. */
export const MAX_PAYLOAD_BYTES = 2048;

/** Arkiv `str` value limit. Writers reject longer `ensName`, `fillTx`, `strategy`, `endpoint`, `version`. */
export const MAX_STRING_BYTES = 128;
