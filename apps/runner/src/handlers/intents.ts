import { hashIntent, verifyIntentSignature, type Address, type Intent } from "@rival/intent";
import type { DegradedFeed } from "../services/degraded-feed.ts";
import type { RunnerDeps } from "../services/deps.ts";
import type { MakerRateLimit } from "../services/limits.ts";
import { ApiError, type IntentJson, type IntentsRequest, type IntentsResponse } from "./types.ts";

/** Same pair label `@rival/arkiv` publishes as `PAIR`. */
const PAIR = "tWETH/tUSDC";
const UINT32_MAX = 4_294_967_295;
const UINT128_MAX = (1n << 128n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;
const DAY_SECS = 86_400;

function parseUint(value: string, field: string, max: bigint): bigint {
  if (!/^[0-9]+$/.test(value)) {
    throw new ApiError("INVALID_PARAMS", `${field} is not a uint`);
  }
  const parsed = BigInt(value);
  if (parsed > max) {
    throw new ApiError("INVALID_PARAMS", `${field} is out of range`);
  }
  return parsed;
}

function parseAddress(value: string, field: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new ApiError("INVALID_PARAMS", `${field} is not an address`);
  }
  return value as Address;
}

function parseBytes32(value: string, field: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new ApiError("INVALID_PARAMS", `${field} is not bytes32`);
  }
  return value as `0x${string}`;
}

function parseBoundedInt(value: number, field: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ApiError("INVALID_PARAMS", `${field} is out of range`);
  }
  return value;
}

/** §7.2 bounds plus the supported tWETH/tUSDC pair. */
function parseIntent(raw: IntentJson, tokens: { weth: Address; usdc: Address }): Intent {
  if (raw.mode !== 0 && raw.mode !== 1) {
    throw new ApiError("INVALID_PARAMS", "mode is out of range");
  }
  if (raw.gate !== 0 && raw.gate !== 1 && raw.gate !== 2) {
    throw new ApiError("INVALID_PARAMS", "gate is out of range");
  }
  const startBps = parseBoundedInt(raw.startBps, "startBps", -5_000, 5_000);
  const floorBps = parseBoundedInt(raw.floorBps, "floorBps", -5_000, 5_000);
  if (startBps < floorBps) {
    throw new ApiError("INVALID_PARAMS", "startBps is below floorBps");
  }
  const decaySecs = parseBoundedInt(raw.decaySecs, "decaySecs", 10, 3_600);
  const startTime = parseBoundedInt(raw.startTime, "startTime", 0, UINT32_MAX);
  const deadline = parseBoundedInt(raw.deadline, "deadline", 0, UINT32_MAX);
  if (deadline < startTime || deadline > startTime + DAY_SECS) {
    throw new ApiError("INVALID_PARAMS", "deadline is outside the allowed window");
  }
  const oracleWindow = parseBoundedInt(raw.oracleWindow, "oracleWindow", 0, UINT32_MAX);
  if (raw.mode === 1 && (oracleWindow < 60 || oracleWindow > 3_600)) {
    throw new ApiError("INVALID_PARAMS", "oracleWindow is outside 60..3600");
  }
  const amountIn = parseUint(raw.amountIn, "amountIn", UINT128_MAX);
  const hardMinOut = parseUint(raw.hardMinOut, "hardMinOut", UINT128_MAX);
  if (amountIn <= 0n || hardMinOut <= 0n) {
    throw new ApiError("INVALID_PARAMS", "amountIn and hardMinOut must be positive");
  }
  const tokenIn = parseAddress(raw.tokenIn, "tokenIn");
  const tokenOut = parseAddress(raw.tokenOut, "tokenOut");
  const supported = new Set([tokens.weth.toLowerCase(), tokens.usdc.toLowerCase()]);
  if (
    tokenIn.toLowerCase() === tokenOut.toLowerCase() ||
    !supported.has(tokenIn.toLowerCase()) ||
    !supported.has(tokenOut.toLowerCase())
  ) {
    throw new ApiError("INVALID_PARAMS", "token pair is not supported");
  }
  return {
    maker: parseAddress(raw.maker, "maker"),
    tokenIn,
    tokenOut,
    amountIn,
    recipient: parseAddress(raw.recipient, "recipient"),
    mode: raw.mode,
    baseOut: parseUint(raw.baseOut, "baseOut", UINT128_MAX),
    oracleWindow,
    startBps,
    floorBps,
    startTime,
    decaySecs,
    deadline,
    hardMinOut,
    gate: raw.gate,
    allowlistHash: parseBytes32(raw.allowlistHash, "allowlistHash"),
    nonce: parseUint(raw.nonce, "nonce", UINT256_MAX),
  };
}

/** `hardMinOut` is below 98% of `quote` when `hardMinOut / quote < 98/100`. */
function floorBelowQuote(hardMinOut: bigint, quote: bigint): boolean {
  return hardMinOut * 100n < quote * 98n;
}

export async function intents(
  deps: RunnerDeps,
  limit: MakerRateLimit,
  feed: DegradedFeed,
  req: IntentsRequest,
): Promise<IntentsResponse> {
  const intent = parseIntent(req.intent, deps.chain.tokens);
  if (deps.clock() > intent.deadline) {
    throw new ApiError("EXPIRED", "intent deadline has passed");
  }

  let signed = false;
  try {
    signed = await verifyIntentSignature({
      intent,
      signature: req.signature,
      permit2: deps.chain.permit2,
      settlement: deps.chain.settlement,
      chainId: deps.chain.chainId,
    });
  } catch {
    signed = false;
  }
  if (!signed) {
    throw new ApiError("INVALID_SIGNATURE", "intent signature does not recover to maker");
  }

  if (await deps.nonceUsed(intent.maker, intent.nonce)) {
    throw new ApiError("NONCE_USED", "permit2 nonce is already used");
  }
  const balance = await deps.balanceOf(intent.maker, intent.tokenIn);
  if (balance < intent.amountIn) {
    throw new ApiError("INSUFFICIENT_BALANCE", "maker balance is below amountIn");
  }

  if (intent.mode === 1) {
    const quote = await deps.oracleQuote(intent);
    if (quote == null) {
      throw new ApiError("ORACLE_STALE", "pegged oracle quote is missing");
    }
    if (floorBelowQuote(intent.hardMinOut, quote)) {
      throw new ApiError("FLOOR_TOO_LOW", "hard floor is below 98% of the oracle quote");
    }
  }

  if (!(await deps.simulateFill(intent))) {
    throw new ApiError("INVALID_PARAMS", "house fill simulation failed");
  }

  const intentHash = hashIntent(intent, deps.chain.domain);
  limit.take(intent.maker);
  try {
    const entityKey = await deps.publish(deps.arkiv, {
      intent,
      signature: req.signature,
      publisher: deps.chain.publisher,
      domain: deps.chain.domain,
      permit2: deps.chain.permit2,
      settlement: deps.chain.settlement,
      chainId: deps.chain.chainId,
      intentHash,
      pair: PAIR,
    });
    return { intentHash, entityKey, degraded: false };
  } catch {
    feed.push({
      intentHash,
      intent: req.intent,
      signature: req.signature,
      degraded: true,
    });
    return { intentHash, degraded: true };
  }
}
