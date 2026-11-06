import { ERROR_STATUS, type ErrorCode } from "../handlers/types.ts";
import { schemas } from "./schema.ts";

export interface SmokeCall {
  method: "GET" | "POST";
  path: "/api/health" | "/api/faucet" | "/api/intents" | "/api/cancel" | "/api/intents/stream";
  body?: unknown;
}

/**
 * One request per operation. POST bodies are invalid so validation can succeed without configured chain deps.
 * Implemented health, faucet, intents, cancel, and stream responses pass. HTTP 501 is not required.
 */
export const SMOKE_CALLS: readonly SmokeCall[] = [
  { method: "GET", path: "/api/health" },
  { method: "POST", path: "/api/faucet", body: {} },
  { method: "POST", path: "/api/intents", body: {} },
  { method: "POST", path: "/api/cancel", body: {} },
  { method: "GET", path: "/api/intents/stream" },
];

const POST_STATUSES: Record<string, readonly number[]> = {
  "/api/faucet": [400, 429],
  "/api/intents": [400, 409, 429, 503],
  "/api/cancel": [400],
};

const SUCCESS = {
  "/api/faucet": schemas.FaucetResponse,
  "/api/intents": schemas.IntentsResponse,
  "/api/cancel": schemas.CancelResponse,
} as const;

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function isNotImplemented(status: number, payload: unknown): boolean {
  return status === 501 && schemas.NotImplementedBody.safeParse(payload).success;
}

function isDomainError(path: string, status: number, payload: unknown): boolean {
  const allowed = POST_STATUSES[path];
  if (!allowed || !allowed.includes(status)) return false;
  if (!schemas.ErrorBody.safeParse(payload).success) return false;
  const code = record(payload)?.code;
  if (typeof code !== "string" || !(code in ERROR_STATUS)) return false;
  if (path === "/api/intents" && code === "ARKIV_UNAVAILABLE") return false;
  return ERROR_STATUS[code as ErrorCode] === status;
}

export function acceptHealth(status: number, payload: unknown): boolean {
  if (isNotImplemented(status, payload)) return true;
  const parsed = schemas.Health.safeParse(payload);
  if (!parsed.success) return false;
  const health = record(parsed.data);
  if (status === 200 && health?.status === "ok") return true;
  if (status === 503 && health?.status === "degraded") return true;
  return false;
}

export function acceptPost(path: string, status: number, payload: unknown): boolean {
  if (isNotImplemented(status, payload)) return true;
  if (isDomainError(path, status, payload)) return true;
  const success = SUCCESS[path as keyof typeof SUCCESS];
  return status === 200 && success.safeParse(payload).success;
}

export function acceptStream(status: number, contentType: string | null, payload: unknown): boolean {
  if (isNotImplemented(status, payload)) return true;
  return status === 200 && (contentType ?? "").includes("text/event-stream");
}
