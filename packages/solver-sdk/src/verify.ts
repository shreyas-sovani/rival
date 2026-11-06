import { getAddress, verifyTypedData, type Hex } from "viem";
import { intentTypedData } from "./intent-type.ts";
import type { Address, Gate, Intent, Mode } from "./types.ts";

export type VerifyReason = "forged" | "expired" | "insufficient balance" | "nonce used" | "bad params";

export type VerifyIntentResult = { accept: true } | { accept: false; reason: VerifyReason };

export interface VerifyIntentArgs {
  /** Intent object or a JSON string of that object. Amounts may be decimal strings. */
  intent: unknown;
  signature: Hex;
  balance: bigint;
  nonceUsed: boolean;
  /** Unix seconds. The intent is expired when this is strictly after `deadline`. */
  now: bigint;
  chainId: number;
  verifyingContract: Address;
}

const UINT32_MAX = 4_294_967_295;
const UINT128_MAX = (1n << 128n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;
const DAY_SECS = 86_400;

const reject = (reason: VerifyReason): VerifyIntentResult => ({ accept: false, reason });

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asAddress(value: unknown): Address | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function asBytes32(value: unknown): Hex | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  return value as Hex;
}

function asUint(value: unknown, max: bigint): bigint | null {
  if (typeof value === "bigint") {
    if (value < 0n || value > max) return null;
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    const parsed = BigInt(value);
    if (parsed > max) return null;
    return parsed;
  }
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) {
    const parsed = BigInt(value);
    if (parsed > max) return null;
    return parsed;
  }
  return null;
}

function asInt(value: unknown, min: number, max: number): number | null {
  let parsed: number;
  if (typeof value === "number") parsed = value;
  else if (typeof value === "string" && /^-?(0|[1-9][0-9]*)$/.test(value)) parsed = Number(value);
  else return null;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

/** Parsed intent, or null when the JSON fails the §7.2 bounds. */
export function readIntent(raw: unknown): Intent | null {
  const record = asRecord(raw);
  if (!record) return null;
  const maker = asAddress(record.maker);
  const tokenIn = asAddress(record.tokenIn);
  const tokenOut = asAddress(record.tokenOut);
  const recipient = asAddress(record.recipient);
  const allowlistHash = asBytes32(record.allowlistHash);
  const amountIn = asUint(record.amountIn, UINT128_MAX);
  const baseOut = asUint(record.baseOut, UINT128_MAX);
  const hardMinOut = asUint(record.hardMinOut, UINT128_MAX);
  const nonce = asUint(record.nonce, UINT256_MAX);
  const mode = asInt(record.mode, 0, 1) as Mode | null;
  const gate = asInt(record.gate, 0, 2) as Gate | null;
  const oracleWindow = asInt(record.oracleWindow, 0, UINT32_MAX);
  const startBps = asInt(record.startBps, -5_000, 5_000);
  const floorBps = asInt(record.floorBps, -5_000, 5_000);
  const startTime = asInt(record.startTime, 0, UINT32_MAX);
  const decaySecs = asInt(record.decaySecs, 10, 3_600);
  const deadline = asInt(record.deadline, 0, UINT32_MAX);
  if (
    !maker ||
    !tokenIn ||
    !tokenOut ||
    !recipient ||
    !allowlistHash ||
    amountIn === null ||
    baseOut === null ||
    hardMinOut === null ||
    nonce === null ||
    mode === null ||
    gate === null ||
    oracleWindow === null ||
    startBps === null ||
    floorBps === null ||
    startTime === null ||
    decaySecs === null ||
    deadline === null
  ) {
    return null;
  }
  if (amountIn <= 0n || hardMinOut <= 0n) return null;
  if (startBps < floorBps) return null;
  if (deadline < startTime || deadline > startTime + DAY_SECS) return null;
  if (mode === 1 && (oracleWindow < 60 || oracleWindow > 3_600)) return null;
  return {
    maker,
    tokenIn,
    tokenOut,
    amountIn,
    recipient,
    mode,
    baseOut,
    oracleWindow,
    startBps,
    floorBps,
    startTime,
    decaySecs,
    deadline,
    hardMinOut,
    gate,
    allowlistHash,
    nonce,
  };
}

function isHexSignature(value: string): value is Hex {
  return /^0x[0-9a-fA-F]+$/.test(value) && value.length >= 132;
}

/** Accept a locally signed intent, or a reason: forged, expired, insufficient balance, nonce used, bad params. */
export async function verifyIntent(args: VerifyIntentArgs): Promise<VerifyIntentResult> {
  if (!Number.isSafeInteger(args.chainId) || args.chainId <= 0) return reject("bad params");
  let verifyingContract: Address;
  try {
    verifyingContract = getAddress(args.verifyingContract);
  } catch {
    return reject("bad params");
  }
  const intent = readIntent(args.intent);
  if (!intent) return reject("bad params");
  if (!isHexSignature(args.signature)) return reject("forged");

  const typed = intentTypedData(intent, args.chainId, verifyingContract);
  let signed = false;
  try {
    signed = await verifyTypedData({
      address: intent.maker,
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
      signature: args.signature,
    });
  } catch {
    signed = false;
  }
  if (!signed) return reject("forged");
  if (args.now > BigInt(intent.deadline)) return reject("expired");
  if (args.nonceUsed) return reject("nonce used");
  if (args.balance < intent.amountIn) return reject("insufficient balance");
  return { accept: true };
}
