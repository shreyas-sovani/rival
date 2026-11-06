import { hashIntent, verifyIntentSignature } from "../../intent/src/index.ts";
import type { Address, Hex, Intent, IntentDomain } from "../../intent/src/types.ts";
import { MAX_PAYLOAD_BYTES } from "./schemas.ts";

export type IntentWitnessContext = {
  domain: IntentDomain;
  permit2: Address;
  settlement: Address;
  chainId: number;
};

export type SignedIntentBody = {
  intent: Intent;
  signature: Hex;
  /** When present, must equal `hashIntent`. */
  intentHash?: Hex;
};

export type VerifiedIntentPayload = {
  intent: Intent;
  signature: Hex;
  intentHash: Hex;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function asAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`payload ${field} is not an address`);
  }
  return value as Address;
}

function asBytes32(value: unknown, field: string): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`payload ${field} is not bytes32`);
  }
  return value as Hex;
}

function asSignature(value: unknown): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value) || value.length < 10) {
    throw new Error("payload signature does not match");
  }
  return value as Hex;
}

function asBigint(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  throw new Error(`payload ${field} is not an integer`);
}

function asInt(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?[0-9]+$/.test(value)) return Number(value);
  throw new Error(`payload ${field} is not an integer`);
}

function asMode(value: unknown): 0 | 1 {
  const mode = asInt(value, "mode");
  if (mode !== 0 && mode !== 1) throw new Error("payload mode is not 0 or 1");
  return mode;
}

function asGate(value: unknown): 0 | 1 | 2 {
  const gate = asInt(value, "gate");
  if (gate !== 0 && gate !== 1 && gate !== 2) throw new Error("payload gate is not 0, 1, or 2");
  return gate;
}

function intentFromUnknown(value: unknown): Intent {
  if (value === null || typeof value !== "object") throw new Error("payload is not a signed intent");
  const raw = value as Record<string, unknown>;
  return {
    maker: asAddress(raw.maker, "maker"),
    tokenIn: asAddress(raw.tokenIn, "tokenIn"),
    tokenOut: asAddress(raw.tokenOut, "tokenOut"),
    amountIn: asBigint(raw.amountIn, "amountIn"),
    recipient: asAddress(raw.recipient, "recipient"),
    mode: asMode(raw.mode),
    baseOut: asBigint(raw.baseOut, "baseOut"),
    oracleWindow: asInt(raw.oracleWindow, "oracleWindow"),
    startBps: asInt(raw.startBps, "startBps"),
    floorBps: asInt(raw.floorBps, "floorBps"),
    startTime: asInt(raw.startTime, "startTime"),
    decaySecs: asInt(raw.decaySecs, "decaySecs"),
    deadline: asInt(raw.deadline, "deadline"),
    hardMinOut: asBigint(raw.hardMinOut, "hardMinOut"),
    gate: asGate(raw.gate),
    allowlistHash: asBytes32(raw.allowlistHash, "allowlistHash"),
    nonce: asBigint(raw.nonce, "nonce"),
  };
}

function jsonIntent(intent: Intent): Record<string, unknown> {
  return {
    maker: intent.maker,
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amountIn.toString(),
    recipient: intent.recipient,
    mode: intent.mode,
    baseOut: intent.baseOut.toString(),
    oracleWindow: intent.oracleWindow,
    startBps: intent.startBps,
    floorBps: intent.floorBps,
    startTime: intent.startTime,
    decaySecs: intent.decaySecs,
    deadline: intent.deadline,
    hardMinOut: intent.hardMinOut.toString(),
    gate: intent.gate,
    allowlistHash: intent.allowlistHash,
    nonce: intent.nonce.toString(),
  };
}

/** UTF-8 JSON `{ intent, signature }` stored in the `payload` column. */
export function encodeIntentPayload(body: { intent: Intent; signature: Hex }): Uint8Array {
  return encoder.encode(JSON.stringify({ intent: jsonIntent(body.intent), signature: body.signature }));
}

export function assertPayloadSize(payload: Uint8Array): void {
  if (payload.byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  }
}

function readBody(payload: Uint8Array | string | SignedIntentBody): {
  intent: Intent;
  signature: Hex;
  intentHash?: Hex;
} {
  if (payload instanceof Uint8Array) {
    return readBody(decoder.decode(payload));
  }
  if (typeof payload === "string") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error("payload is not a signed intent");
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload is not a signed intent");
    }
    const record = parsed as Record<string, unknown>;
    const intentHash = record.intentHash === undefined ? undefined : asBytes32(record.intentHash, "intentHash");
    return { intent: intentFromUnknown(record.intent), signature: asSignature(record.signature), intentHash };
  }
  const intentHash = payload.intentHash === undefined ? undefined : asBytes32(payload.intentHash, "intentHash");
  return {
    intent: intentFromUnknown(payload.intent),
    signature: asSignature(payload.signature),
    intentHash,
  };
}

function sameHash(left: Hex, right: Hex): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Recomputes the intent hash and checks the Permit2 witness signature.
 * A payload that only parses is rejected.
 */
export async function verifyPayload(
  payload: Uint8Array | string | SignedIntentBody,
  context: IntentWitnessContext & { intentHash?: Hex },
): Promise<VerifiedIntentPayload> {
  const body = readBody(payload);
  const intentHash = hashIntent(body.intent, context.domain);
  if (body.intentHash !== undefined && !sameHash(body.intentHash, intentHash)) {
    throw new Error("payload hash does not match");
  }
  if (context.intentHash !== undefined && !sameHash(context.intentHash, intentHash)) {
    throw new Error("payload hash does not match");
  }
  let signed = false;
  try {
    signed = await verifyIntentSignature({
      intent: body.intent,
      signature: body.signature,
      permit2: context.permit2,
      settlement: context.settlement,
      chainId: context.chainId,
    });
  } catch {
    signed = false;
  }
  if (!signed) throw new Error("payload signature does not match");
  return { intent: body.intent, signature: body.signature, intentHash };
}
