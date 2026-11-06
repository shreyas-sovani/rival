/**
 * Frozen handler contract (F3). Routes validate the OpenAPI body, then call these functions.
 * Amounts that are `UintString` on the wire stay decimal strings here. Handlers parse them.
 * Do not change signatures after C0 without `pnpm freeze:write --bump`.
 */

export const ERROR_CODES = [
  "INVALID_SIGNATURE",
  "INVALID_PARAMS",
  "EXPIRED",
  "INSUFFICIENT_BALANCE",
  "NONCE_USED",
  "FLOOR_TOO_LOW",
  "RATE_LIMITED",
  "ORACLE_STALE",
  "ARKIV_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** HTTP status each domain code uses. ARKIV_UNAVAILABLE is not thrown by POST /api/intents. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  INVALID_SIGNATURE: 400,
  INVALID_PARAMS: 400,
  EXPIRED: 400,
  INSUFFICIENT_BALANCE: 400,
  FLOOR_TOO_LOW: 400,
  NONCE_USED: 409,
  RATE_LIMITED: 429,
  ORACLE_STALE: 503,
  ARKIV_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
  }
}

/** Thrown by stub handlers. Routes map it to HTTP 501 `{ code: "NOT_IMPLEMENTED", message }`. */
export class NotImplemented extends Error {
  readonly code = "NOT_IMPLEMENTED" as const;
  readonly status = 501;

  constructor(taskId: string) {
    super(`NOT_IMPLEMENTED(${taskId})`);
    this.name = "NotImplemented";
  }
}

export type Address = `0x${string}`;
export type Bytes32 = `0x${string}`;
export type UintString = string;

export interface IntentJson {
  maker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: UintString;
  recipient: Address;
  mode: 0 | 1;
  baseOut: UintString;
  oracleWindow: number;
  startBps: number;
  floorBps: number;
  startTime: number;
  decaySecs: number;
  deadline: number;
  hardMinOut: UintString;
  gate: 0 | 1 | 2;
  allowlistHash: Bytes32;
  nonce: UintString;
}

export interface HealthRequest {
  readonly _tag?: "health";
}

export interface OraclePoolHealth {
  ageSec: number;
  obs: number;
}

export interface BotHealth {
  ok: boolean;
  lastSeenAt: number | null;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  block: { number: UintString; lagSec: number };
  oracle: { A: OraclePoolHealth; B?: OraclePoolHealth };
  bots: Record<string, BotHealth>;
  house: { eth: UintString; tWETH: UintString; tUSDC: UintString };
  arkiv: { ok: boolean; latencyMs: number };
  openIntents: number;
  lastFillAt: number | null;
}

export interface FaucetRequest {
  wallet: Address;
  signature: `0x${string}`;
  day: number;
  kind: "tokens" | "eth";
}

export interface FaucetResponse {
  txHash: Bytes32;
  nextEligibleAt: number;
}

export interface IntentsRequest {
  intent: IntentJson;
  signature: `0x${string}`;
}

export interface IntentsResponse {
  intentHash: Bytes32;
  entityKey?: string;
  degraded: boolean;
}

export interface CancelRequest {
  intentHash: Bytes32;
  deadline: number;
  signature: `0x${string}`;
}

export interface CancelResponse {
  txHash: Bytes32;
}

export interface StreamRequest {
  signal?: AbortSignal;
}

export interface IntentStreamData {
  intentHash: Bytes32;
  intent: IntentJson;
  signature: `0x${string}`;
  degraded: true;
}

export type HealthHandler = (req: HealthRequest) => Promise<HealthResponse>;
export type FaucetHandler = (req: FaucetRequest) => Promise<FaucetResponse>;
export type IntentsHandler = (req: IntentsRequest) => Promise<IntentsResponse>;
export type CancelHandler = (req: CancelRequest) => Promise<CancelResponse>;
export type StreamHandler = (req: StreamRequest) => Promise<AsyncIterable<IntentStreamData>>;

export interface Handlers {
  health: HealthHandler;
  faucet: FaucetHandler;
  intents: IntentsHandler;
  cancel: CancelHandler;
  stream: StreamHandler;
}
