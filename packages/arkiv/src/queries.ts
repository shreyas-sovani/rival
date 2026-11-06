import { and, between, eq, gt, type Expression } from "@arkiv-network/sdk/query";
import { addr, i32, str, u256, u64 } from "@arkiv-network/sdk/schema";
import type { Address } from "../../intent/src/types.ts";
import { INTENT_SCHEMA, PRESENCE_SCHEMA } from "./schemas.ts";

/** Arkiv rejects pages larger than this (`MAX_LIMIT`). */
export const MAX_PAGE_SIZE = 100;

export type IntentQueryArgs = {
  /** Unix seconds. Interpolated as `u64(<decimal>)` when a deadline bound is included. */
  now?: number;
  pair?: string;
  status?: string;
  maker?: Address;
  gate?: number;
  amountInMin?: bigint;
  amountInMax?: bigint;
  /** Overrides `now` as the `deadline > u64(...)` bound. */
  deadlineAfter?: number;
  sortDeadlineAsc?: boolean;
  limit?: number;
};

function deadlineOf(args: IntentQueryArgs): number | undefined {
  return args.deadlineAfter ?? args.now;
}

function assertUnix(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer unix second`);
  }
}

function schemaClause(name: string): Expression {
  return eq("arkiv.schema", str(name));
}

function statusClause(status: string): Expression {
  return eq("status", str(status));
}

function rangeClause(min: bigint, max: bigint): Expression {
  return between("amountIn", u256(min), u256(max));
}

function requireRange(args: IntentQueryArgs): { min: bigint; max: bigint } | undefined {
  if (args.amountInMin === undefined && args.amountInMax === undefined) return undefined;
  if (args.amountInMin === undefined || args.amountInMax === undefined) {
    throw new Error("amountIn min and max must both be set");
  }
  return { min: args.amountInMin, max: args.amountInMax };
}

/**
 * Canonical intent-book query.
 *
 * Clause order follows `specs/arkiv-queries.md` for each example shape (open watch,
 * amount `BETWEEN`, maker, named gate). `now` and `deadlineAfter` are written as
 * `u64(<decimal>)`. There is no `<now>` token.
 */
export function buildIntentQuery(args: IntentQueryArgs): string {
  const range = requireRange(args);
  const deadline = deadlineOf(args);
  if (deadline !== undefined) assertUnix(deadline, "deadline");

  const bare =
    args.pair === undefined &&
    range === undefined &&
    deadline === undefined &&
    args.maker === undefined;

  let parts: Expression[];
  if (bare && args.gate !== undefined && args.status !== undefined) {
    parts = [schemaClause(INTENT_SCHEMA), eq("gate", i32(args.gate)), statusClause(args.status)];
  } else if (
    bare &&
    args.maker !== undefined &&
    args.status === undefined &&
    args.gate === undefined
  ) {
    parts = [schemaClause(INTENT_SCHEMA), eq("maker", addr(args.maker))];
  } else if (
    range !== undefined &&
    args.pair === undefined &&
    args.maker === undefined &&
    args.gate === undefined &&
    deadline === undefined
  ) {
    parts = [schemaClause(INTENT_SCHEMA)];
    if (args.status !== undefined) parts.push(statusClause(args.status));
    parts.push(rangeClause(range.min, range.max));
  } else {
    parts = [schemaClause(INTENT_SCHEMA)];
    if (args.status !== undefined) parts.push(statusClause(args.status));
    if (args.pair !== undefined) parts.push(eq("pair", str(args.pair)));
    if (args.maker !== undefined) parts.push(eq("maker", addr(args.maker)));
    if (args.gate !== undefined) parts.push(eq("gate", i32(args.gate)));
    if (range !== undefined) parts.push(rangeClause(range.min, range.max));
    if (deadline !== undefined) parts.push(gt("deadline", u64(deadline)));
  }

  const text = and(...parts).toString();
  if (!args.sortDeadlineAsc) return text;
  return `${text} ORDER BY deadline:u64 ASC`;
}

/** Presence filter. The count projection wraps this; it is not part of the string. */
export function buildPresenceQuery(pair: string): string {
  return and(schemaClause(PRESENCE_SCHEMA), eq("pair", str(pair))).toString();
}

export function assertPageSize(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error(`page size max is ${MAX_PAGE_SIZE}`);
  }
}
