import { verifyPayload, type IntentWitnessContext } from "@rival/arkiv";
import type { Address, Bytes32 } from "../handlers/types.ts";
import { readIntentStatus } from "./chain.ts";

export interface BookRow {
  intentHash: Bytes32;
  maker: Address;
  pair: string;
  amountIn: string;
  mode: 0 | 1;
  gate: 0 | 1 | 2;
  status: "open" | "filled" | "cancelled";
  deadline: number;
  signatureOk: boolean;
  chainStatus: "open" | "filled" | "cancelled" | "unknown";
  entityKey?: string;
  floor?: string;
}

export function pageEntities(page: unknown): unknown[] {
  if (Array.isArray(page)) return page;
  if (!page || typeof page !== "object") return [];
  const entities = (page as { entities?: unknown }).entities;
  return Array.isArray(entities) ? [...entities] : [];
}

export function entityPayload(entity: unknown): Uint8Array | string | undefined {
  const payload = field(entity, "payload");
  if (payload instanceof Uint8Array || typeof payload === "string") return payload;
  return undefined;
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

function unwrap(value: unknown): unknown {
  if (value && typeof value === "object" && !(value instanceof Uint8Array) && "value" in value) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function decimal(value: unknown): string | undefined {
  if (typeof value === "bigint" && value >= 0n) return value.toString();
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^[0-9]+$/.test(value)) return value;
  return undefined;
}

function address(value: unknown): Address | undefined {
  if (typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)) return value as Address;
  return undefined;
}

function bytes32(value: unknown): Bytes32 | undefined {
  if (typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)) return value as Bytes32;
  return undefined;
}

function integer(value: unknown): number | undefined {
  if (typeof value === "bigint" && value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?[0-9]+$/.test(value)) return Number(value);
  return undefined;
}

function entityKeyOf(entity: unknown): string | undefined {
  return bytes32(field(entity, "entityKey")) ?? bytes32(field(entity, "$key")) ?? bytes32(field(entity, "key"));
}

export async function rowFromEntity(entity: unknown, context: IntentWitnessContext): Promise<BookRow | undefined> {
  const payload = entityPayload(entity);
  let signatureOk = false;
  let fromPayload: {
    intentHash?: Bytes32;
    maker?: Address;
    amountIn?: string;
    mode?: 0 | 1;
    gate?: 0 | 1 | 2;
    deadline?: number;
    floor?: string;
  } = {};
  if (payload) {
    try {
      const verified = await verifyPayload(payload, context);
      signatureOk = true;
      fromPayload = {
        intentHash: verified.intentHash,
        maker: verified.intent.maker,
        amountIn: verified.intent.amountIn.toString(),
        mode: verified.intent.mode,
        gate: verified.intent.gate,
        deadline: verified.intent.deadline,
        floor: verified.intent.hardMinOut.toString(),
      };
    } catch {
      signatureOk = false;
    }
  }
  const intentHash = fromPayload.intentHash ?? bytes32(field(entity, "intentHash"));
  const maker = fromPayload.maker ?? address(field(entity, "maker"));
  const amountIn = fromPayload.amountIn ?? decimal(field(entity, "amountIn"));
  const mode = fromPayload.mode ?? integer(field(entity, "mode"));
  const gate = fromPayload.gate ?? integer(field(entity, "gate"));
  const deadline = fromPayload.deadline ?? integer(field(entity, "deadline"));
  const pair = field(entity, "pair");
  const status = field(entity, "status");
  if (!intentHash || !maker || !amountIn || (mode !== 0 && mode !== 1) || (gate !== 0 && gate !== 1 && gate !== 2)) {
    return undefined;
  }
  if (typeof pair !== "string" || (status !== "open" && status !== "filled" && status !== "cancelled")) return undefined;
  if (deadline === undefined || deadline < 0) return undefined;
  const chainStatus = await readIntentStatus(intentHash);
  const floor = fromPayload.floor ?? decimal(field(entity, "hardMinOut"));
  const entityKey = entityKeyOf(entity);
  return {
    intentHash,
    maker,
    pair,
    amountIn,
    mode,
    gate,
    status,
    deadline,
    signatureOk,
    chainStatus,
    ...(entityKey ? { entityKey } : {}),
    ...(floor ? { floor } : {}),
  };
}
