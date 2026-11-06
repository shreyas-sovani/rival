import {
  countPresence,
  createArkivClients,
  publishIntent,
  queryOpenIntents,
  type PublishIntentInput,
} from "@rival/arkiv";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { safeReason } from "./chain.ts";

interface ArkivWriter {
  createEntity: (schema: unknown, values: unknown, options?: unknown) => Promise<{ entityKey: Hex }>;
}

function privateKey(name: string): Hex | undefined {
  const value = process.env[name]?.trim();
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) return undefined;
  return value as Hex;
}

export function arkivReadKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.ARKIV_ACCESS_KEYS_READ;
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
  }
  const write = env.ARKIV_ACCESS_KEY_WRITE?.trim();
  return write ? [write] : [];
}

function boundedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(8_000) });
}

function readClient() {
  const readKeys = arkivReadKeys();
  if (readKeys.length === 0) return undefined;
  const writeKey = process.env.ARKIV_ACCESS_KEY_WRITE?.trim();
  return createArkivClients({
    readKeys,
    ...(writeKey ? { writeKey } : {}),
    transport: boundedFetch,
  }).read;
}

export function arkivWriter(): ArkivWriter | undefined {
  const readKeys = arkivReadKeys();
  const writeKey = process.env.ARKIV_ACCESS_KEY_WRITE?.trim();
  const accountKey = privateKey("RELAYER_PRIVATE_KEY") ?? privateKey("HOUSE_PRIVATE_KEY");
  if (readKeys.length === 0 || !writeKey || !accountKey) return undefined;
  const client = createArkivClients({ readKeys, writeKey, transport: boundedFetch }).wallet(privateKeyToAccount(accountKey));
  return {
    createEntity: async (schema, values, options) => {
      const created = await client.createEntity(schema as never, values as never, options as never);
      return { entityKey: created.entityKey as Hex };
    },
  };
}

export async function publishSigned(input: PublishIntentInput): Promise<Hex> {
  const writer = arkivWriter();
  if (!writer) throw new Error("arkiv writer is not configured");
  return publishIntent(writer as Parameters<typeof publishIntent>[0], input);
}

export async function readOpenIntents(pair: string, status: string, now: number, limit = 100): Promise<unknown> {
  const client = readClient();
  if (!client) throw new Error("arkiv reader is not configured");
  return queryOpenIntents({
    client,
    now,
    pair,
    status,
    limit,
  });
}

export async function readPresence(pair: string): Promise<number> {
  const client = readClient();
  if (!client) throw new Error("arkiv reader is not configured");
  const count = await countPresence(client, pair);
  const asNumber = Number(count);
  if (!Number.isFinite(asNumber) || asNumber < 0) throw new Error("presence count unread");
  return asNumber;
}

/** Time a one-row open-intent query. Failure is a degraded probe, not a fabricated latency. */
export async function readArkivLatency(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = Date.now();
  try {
    await readOpenIntents("tWETH/tUSDC", "open", Math.floor(Date.now() / 1000), 1);
    return { ok: true, latencyMs: Math.max(0, Date.now() - started) };
  } catch (error) {
    void safeReason(error);
    return { ok: false, latencyMs: 0 };
  }
}

export async function readOpenIntentCount(): Promise<number> {
  const page = await readOpenIntents("tWETH/tUSDC", "open", Math.floor(Date.now() / 1000), 100);
  return pageCount(page);
}

export function pageCount(page: unknown): number {
  if (!page || typeof page !== "object") return 0;
  const count = (page as { count?: unknown }).count;
  if (typeof count === "bigint" && count >= 0n && count <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(count);
  if (typeof count === "number" && Number.isInteger(count) && count >= 0) return count;
  const entities = (page as { entities?: unknown }).entities;
  return Array.isArray(entities) ? entities.length : 0;
}
