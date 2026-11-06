import { ExpirationTime, type PublicArkivClient, type WalletArkivClient } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { addr, u64, type PatchEntityValues } from "@arkiv-network/sdk/schema";
import type { Hex } from "viem";
import type { Address, Intent } from "../../intent/src/types.ts";
import {
  assertPayloadSize,
  encodeIntentPayload,
  verifyPayload,
  type IntentWitnessContext,
} from "./payload.ts";
import { assertPageSize, buildIntentQuery, type IntentQueryArgs, MAX_PAGE_SIZE } from "./queries.ts";
import { IntentEntity, PAIR, SolverPresence } from "./schemas.ts";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const PRESENCE_MINUTES = 3;

export type PublishIntentInput = IntentWitnessContext & {
  intent: Intent;
  signature: Hex;
  publisher: Address;
  pair?: string;
  /** Claimed hash. Rejected when it disagrees with `hashIntent`. */
  intentHash?: Hex;
  /** Prebuilt payload bytes. Size is checked before verification. */
  payload?: Uint8Array;
};

type Writer = Pick<WalletArkivClient, "createEntity" | "extendEntity" | "patchEntity">;
type Reader = Pick<PublicArkivClient, "query" | "count">;

/** Publish a signed intent. Status starts at `open`. Expires at `deadline + 5 minutes`. */
export async function publishIntent(client: Pick<Writer, "createEntity">, input: PublishIntentInput): Promise<Hex> {
  const payload = input.payload ?? encodeIntentPayload(input);
  assertPayloadSize(payload);
  const verified = await verifyPayload(payload, input);
  const deadlineMs = verified.intent.deadline * 1000 + FIVE_MINUTES_MS;
  const created = await client.createEntity(
    IntentEntity,
    {
      intentHash: verified.intentHash,
      maker: addr(verified.intent.maker),
      pair: input.pair ?? PAIR,
      tokenIn: addr(verified.intent.tokenIn),
      tokenOut: addr(verified.intent.tokenOut),
      amountIn: verified.intent.amountIn,
      mode: verified.intent.mode,
      gate: verified.intent.gate,
      startTime: u64(verified.intent.startTime),
      deadline: u64(verified.intent.deadline),
      decaySecs: verified.intent.decaySecs,
      startBps: verified.intent.startBps,
      floorBps: verified.intent.floorBps,
      hardMinOut: verified.intent.hardMinOut,
      status: "open",
      publisher: addr(input.publisher),
      payload,
    },
    { expiration: ExpirationTime.atDate(new Date(deadlineMs)) },
  );
  return created.entityKey;
}

export type QueryOpenIntentsArgs = IntentQueryArgs & {
  now: number;
  client: Pick<Reader, "query">;
};

/** Build the canonical query and run it. Page size defaults to 100 and cannot exceed it. */
export async function queryOpenIntents(args: QueryOpenIntentsArgs): Promise<Awaited<ReturnType<Reader["query"]>>> {
  const limit = args.limit ?? MAX_PAGE_SIZE;
  assertPageSize(limit);
  const query = buildIntentQuery({ ...args, status: args.status ?? "open" });
  return args.client.query(query, { limit });
}

/**
 * Count live solver presence for a pair.
 * Uses the SDK count projection (`client.count().from(schema).where(...).fetch()`).
 */
export async function countPresence(client: Pick<Reader, "count">, pair: string): Promise<bigint> {
  return client.count().from(SolverPresence).where(eq("pair", pair)).fetch();
}

export type PresenceInput = {
  solver: Address;
  ensName: string;
  pair: string;
  maxAmountIn: bigint;
  strategy: string;
  endpoint?: string;
  version: string;
  /** When set, extend this entity instead of creating one. */
  entityKey?: Hex;
};

/** Create `rival.solver.v1` or extend it. Expiry is 3 minutes. The caller owns the 60s cadence. */
export async function upsertPresence(client: Pick<Writer, "createEntity" | "extendEntity">, input: PresenceInput): Promise<Hex> {
  const expiration = ExpirationTime.fromMinutes(PRESENCE_MINUTES);
  if (input.entityKey !== undefined) {
    const extended = await client.extendEntity({ entityKey: input.entityKey, expiration });
    return extended.entityKey;
  }
  const created = await client.createEntity(
    SolverPresence,
    {
      solver: addr(input.solver),
      ensName: input.ensName,
      pair: input.pair,
      maxAmountIn: input.maxAmountIn,
      strategy: input.strategy,
      ...(input.endpoint !== undefined ? { endpoint: input.endpoint } : {}),
      version: input.version,
    },
    { expiration },
  );
  return created.entityKey;
}

export type StatusPatch = {
  status: "filled" | "cancelled";
  filledBy?: Address;
  fillTx?: string;
};

/** Patch advisory status. Solvers still re-check the chain. */
export async function patchStatus(
  client: Pick<Writer, "patchEntity">,
  entityKey: Hex,
  update: StatusPatch,
): Promise<Hex> {
  if (update.status !== "filled" && update.status !== "cancelled") {
    throw new Error("status must be filled or cancelled");
  }
  const set: PatchEntityValues<typeof IntentEntity> = {
    status: update.status,
    ...(update.filledBy !== undefined ? { filledBy: addr(update.filledBy) } : {}),
    ...(update.fillTx !== undefined ? { fillTx: update.fillTx } : {}),
  };
  const patched = await client.patchEntity(IntentEntity, entityKey, { set });
  return patched.entityKey;
}
