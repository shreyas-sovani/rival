import { PAIR } from "@rival/arkiv";
import type { Address, Intent } from "@rival/intent";
import type { Hex } from "viem";
import type { BookSourceRow } from "./book.ts";
import { publicDeployment } from "./public-deployment.ts";
import { intentToWire, type WireIntent } from "./wire.ts";

/** `deployments/sepolia.json` `runnerUrl`. public-deployment omits it on purpose. */
export const PUBLIC_RUNNER_ORIGIN = "https://rival-runner.fly.dev";

export const CHAIN_ID = 11155111;

/**
 * EIP-712 verifying contract for `FaucetClaim`.
 * The runner sets `chain.faucet` to the tWETH token (`apps/runner/src/services/chain.ts`).
 * A zero-address domain does not recover on that runner.
 */
export const FAUCET_VERIFYING_CONTRACT = publicDeployment.tokens.tWETH as Address;

export const DEGRADED_BOOK_BANNER = "Book degraded: using runner feed";

export function runnerOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_RUNNER_URL;
  if (typeof configured === "string" && configured.trim() !== "") {
    return configured.trim().replace(/\/$/, "");
  }
  return PUBLIC_RUNNER_ORIGIN;
}

export interface IntentsResponse {
  intentHash: Hex;
  entityKey?: string;
  degraded: boolean;
}

export interface BookFeed {
  rows: BookSourceRow[];
  presence: number;
  asOf: number | null;
  source: "arkiv" | "degraded";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.message === "string" && body.message.trim() !== "") {
      return body.message;
    }
  } catch {
    // Non-JSON bodies stay on the status line.
  }
  return `Request failed (${response.status})`;
}

function uintString(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw new Error(`${label} is not a decimal string`);
  }
  return BigInt(value);
}

function address(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} is not an address`);
  }
  return value;
}

function bytes32(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} is not a bytes32`);
  }
  return value;
}

/** House token balances, or an explicit `faucet.stocked` flag when the runner adds one. */
export function faucetIsStocked(health: unknown): boolean {
  if (!isRecord(health)) return false;
  const faucet = health.faucet;
  if (isRecord(faucet) && typeof faucet.stocked === "boolean") return faucet.stocked;
  const house = health.house;
  if (!isRecord(house)) return false;
  return positiveUint(house.tWETH) && positiveUint(house.tUSDC);
}

function positiveUint(value: unknown): boolean {
  return typeof value === "string" && /^[0-9]+$/.test(value) && BigInt(value) > 0n;
}

export async function readHealth(): Promise<unknown> {
  const response = await fetch(`${runnerOrigin()}/api/health`);
  if (!response.ok && response.status !== 503) {
    throw new Error(await readApiError(response));
  }
  return response.json();
}

function parseRow(value: unknown): BookSourceRow {
  if (!isRecord(value)) throw new Error("book row is not an object");
  const deadline = value.deadline;
  if (typeof deadline !== "number" || !Number.isInteger(deadline) || deadline < 0) {
    throw new Error("deadline is not a unix second");
  }
  const mode = value.mode;
  const gate = value.gate;
  if (mode !== 0 && mode !== 1) throw new Error("mode is not 0 or 1");
  if (gate !== 0 && gate !== 1 && gate !== 2) throw new Error("gate is not 0, 1, or 2");
  if (typeof value.status !== "string" || typeof value.chainStatus !== "string") {
    throw new Error("status is missing");
  }
  if (typeof value.signatureOk !== "boolean") throw new Error("signatureOk is missing");
  const pair = typeof value.pair === "string" ? value.pair : PAIR;
  const row: BookSourceRow = {
    intentHash: bytes32(value.intentHash, "intentHash"),
    maker: address(value.maker, "maker"),
    pair,
    amountIn: uintString(value.amountIn, "amountIn"),
    mode,
    gate,
    status: value.status,
    deadline,
    signatureOk: value.signatureOk,
    chainStatus: value.chainStatus,
  };
  if (typeof value.entityKey === "string" && value.entityKey !== "") row.entityKey = value.entityKey;
  if (typeof value.floor === "string") row.floor = value.floor;
  else if (typeof value.floor === "number" && Number.isFinite(value.floor)) row.floor = String(value.floor);
  return row;
}

export function parseBookFeed(body: unknown): BookFeed {
  if (!isRecord(body)) throw new Error("book feed is not an object");
  if (body.source !== "arkiv" && body.source !== "degraded") throw new Error("book source is missing");
  if (typeof body.presence !== "number" || !Number.isInteger(body.presence) || body.presence < 0) {
    throw new Error("presence is missing");
  }
  if (!Array.isArray(body.rows)) throw new Error("rows are missing");
  const asOf = body.asOf;
  return {
    rows: body.rows.map(parseRow),
    presence: body.presence,
    asOf: typeof asOf === "number" && Number.isFinite(asOf) ? asOf : null,
    source: body.source,
  };
}

export async function fetchOpenBook(pair = PAIR): Promise<BookFeed> {
  const url = new URL(`${runnerOrigin()}/api/intents`);
  url.searchParams.set("pair", pair);
  url.searchParams.set("status", "open");
  const response = await fetch(url);
  if (!response.ok) throw new Error(await readApiError(response));
  return parseBookFeed(await response.json());
}

export async function postSignedIntent(args: {
  endpoint: string;
  intent: Intent;
  signature: string;
  /** In scope so the egress test can prove the key is not copied onto the request. */
  wallet: { address: Address; privateKey: Hex };
}): Promise<IntentsResponse> {
  if (args.wallet.address.toLowerCase() !== args.intent.maker.toLowerCase()) {
    throw new Error("signer is not the maker");
  }
  const wire: WireIntent = intentToWire(args.intent);
  const body = JSON.stringify({ intent: wire, signature: args.signature });
  const response = await fetch(args.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const parsed: unknown = await response.json();
  if (!isRecord(parsed) || typeof parsed.degraded !== "boolean") {
    throw new Error("publish response is missing degraded");
  }
  const intentHash = bytes32(parsed.intentHash, "intentHash");
  const result: IntentsResponse = { intentHash: intentHash as Hex, degraded: parsed.degraded };
  if (typeof parsed.entityKey === "string" && parsed.entityKey !== "") result.entityKey = parsed.entityKey;
  return result;
}

export async function postFaucet(args: {
  wallet: Address;
  signature: Hex;
  day: number;
  kind: "tokens" | "eth";
}): Promise<{ txHash: Hex; nextEligibleAt: number }> {
  const response = await fetch(`${runnerOrigin()}/api/faucet`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      wallet: args.wallet,
      signature: args.signature,
      day: args.day,
      kind: args.kind,
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const parsed: unknown = await response.json();
  if (!isRecord(parsed)) throw new Error("faucet response is empty");
  const txHash = bytes32(parsed.txHash, "txHash");
  if (typeof parsed.nextEligibleAt !== "number") throw new Error("faucet response is missing nextEligibleAt");
  return { txHash: txHash as Hex, nextEligibleAt: parsed.nextEligibleAt };
}

export async function postCancel(args: {
  intentHash: Hex;
  deadline: number;
  signature: Hex;
}): Promise<{ txHash: Hex }> {
  const response = await fetch(`${runnerOrigin()}/api/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      intentHash: args.intentHash,
      deadline: args.deadline,
      signature: args.signature,
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const parsed: unknown = await response.json();
  if (!isRecord(parsed)) throw new Error("cancel response is empty");
  return { txHash: bytes32(parsed.txHash, "txHash") as Hex };
}

export function settlementAddress(): Address {
  return publicDeployment.settlement as Address;
}

export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
