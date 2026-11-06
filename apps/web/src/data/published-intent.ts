import type { Intent } from "@rival/intent";
import type { Hex } from "viem";
import type { StoragePort } from "../wallet/storage.ts";
import { intentToWire, wireToIntent, type WireIntent } from "./wire.ts";

export interface StoredIntent {
  intent: WireIntent;
  poolOut: string | null;
  twapOut: string | null;
  /** Already formatted, or the honest unavailable sentence. */
  poolDirectAtSign: string;
  entityKey?: string;
  degraded: boolean;
}

function key(intentHash: string): string {
  return `rival.published.v1.${intentHash.toLowerCase()}`;
}

export async function savePublishedIntent(storage: StoragePort, intentHash: string, record: StoredIntent): Promise<void> {
  await storage.set(key(intentHash), JSON.stringify(record));
}

export async function loadPublishedIntent(storage: StoragePort, intentHash: string): Promise<StoredIntent | null> {
  const raw = await storage.get(key(intentHash));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as StoredIntent;
    if (!parsed?.intent) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storedToIntent(record: StoredIntent): Intent {
  return wireToIntent(record.intent);
}

export function recordFromIntent(args: {
  intent: Intent;
  poolOut: bigint | null;
  twapOut: bigint | null;
  poolDirectAtSign: string;
  entityKey?: string;
  degraded: boolean;
}): StoredIntent {
  const record: StoredIntent = {
    intent: intentToWire(args.intent),
    poolOut: args.poolOut === null ? null : args.poolOut.toString(),
    twapOut: args.twapOut === null ? null : args.twapOut.toString(),
    poolDirectAtSign: args.poolDirectAtSign,
    degraded: args.degraded,
  };
  if (args.entityKey) record.entityKey = args.entityKey;
  return record;
}

export function quoteBigint(value: string | null): bigint | null {
  if (value === null || !/^[0-9]+$/.test(value)) return null;
  return BigInt(value);
}

export function isIntentHash(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
