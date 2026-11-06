import type { PublishIntentInput } from "@rival/arkiv";
import type { Address as IntentAddress, Intent, IntentDomain } from "@rival/intent";
import { MAX_BLOCK_LAG_SEC, MAX_ORACLE_AGE_SEC } from "../handlers/health.ts";
import type {
  BotHealth,
  Bytes32,
  CancelRequest,
  FaucetRequest,
  HealthResponse,
  OraclePoolHealth,
} from "../handlers/types.ts";

/**
 * Every process boundary the handlers can touch.
 * Chain writes still throw until they are wired.
 * Health probes never throw: a missing Sepolia RPC or Arkiv client is a degraded field.
 * `probes.block` reads `SEPOLIA_RPC_URL` and reports that head when the call succeeds.
 */
export interface ArkivWriter {
  createEntity: (
    schema: unknown,
    values: unknown,
    options?: unknown,
  ) => Promise<{ entityKey: Bytes32 }>;
}

/** `(client, input) => entityKey`, the same call shape as `@rival/arkiv` `publishIntent`. */
export type IntentPublisher = (client: ArkivWriter, input: PublishIntentInput) => Promise<Bytes32>;

export interface RunnerDeps {
  clock: () => number;
  /** Source address for the faucet IP cap. Routes set this per request. */
  clientIp: () => string;
  chain: {
    chainId: number;
    permit2: IntentAddress;
    settlement: IntentAddress;
    domain: IntentDomain;
    faucet: IntentAddress;
    publisher: IntentAddress;
    tokens: { weth: IntentAddress; usdc: IntentAddress };
  };
  limits: {
    maxIntentsPerMaker: number;
    intentWindowSec: number;
    maxTokenClaimsPerIp: number;
  };
  nonceUsed: (maker: IntentAddress, nonce: bigint) => Promise<boolean>;
  balanceOf: (maker: IntentAddress, token: IntentAddress) => Promise<bigint>;
  /** PEGGED output quote. `null` means the oracle has nothing usable. */
  oracleQuote: (intent: Intent) => Promise<bigint | null>;
  /** House-solver `eth_call`. `false` rejects the intent. */
  simulateFill: (intent: Intent) => Promise<boolean>;
  arkiv: ArkivWriter;
  publish: IntentPublisher;
  mint: (req: FaucetRequest) => Promise<Bytes32>;
  ethRemaining: () => Promise<number>;
  verifyCancel: (req: CancelRequest) => Promise<boolean>;
  relayCancel: (req: CancelRequest) => Promise<Bytes32>;
  probes: {
    block: () => Promise<HealthResponse["block"]>;
    oracle: () => Promise<{ A: OraclePoolHealth; B?: OraclePoolHealth }>;
    bots: () => Promise<Record<string, BotHealth>>;
    house: () => Promise<HealthResponse["house"]>;
    arkiv: () => Promise<HealthResponse["arkiv"]>;
    openIntents: () => Promise<number>;
    lastFillAt: () => Promise<number | null>;
  };
}

function unconfigured(name: string): never {
  throw new Error(`runner dependency ${name} is not configured`);
}

const DEGRADED_BLOCK: HealthResponse["block"] = { number: "0", lagSec: MAX_BLOCK_LAG_SEC + 1 };

const DEGRADED_ORACLE = { A: { ageSec: MAX_ORACLE_AGE_SEC + 1, obs: 0 } };

const DEGRADED_ARKIV: HealthResponse["arkiv"] = { ok: false, latencyMs: 0 };

function sepoliaRpcUrl(): string | undefined {
  const value = process.env.SEPOLIA_RPC_URL;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function hexQuantity(value: unknown): bigint | undefined {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function blockFromRpc(payload: unknown): HealthResponse["block"] | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const result = (payload as { result?: unknown }).result;
  if (!result || typeof result !== "object") return undefined;
  const number = hexQuantity((result as { number?: unknown }).number);
  const timestamp = hexQuantity((result as { timestamp?: unknown }).timestamp);
  if (number === undefined || timestamp === undefined) return undefined;
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  const lagSec = Math.max(0, Math.floor(Date.now() / 1000) - Number(timestamp));
  return { number: number.toString(), lagSec };
}

/** Latest Sepolia head, or a lagging block when the RPC is missing or the call fails. */
async function readSepoliaBlock(): Promise<HealthResponse["block"]> {
  const rpc = sepoliaRpcUrl();
  if (!rpc) return DEGRADED_BLOCK;
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBlockByNumber",
        params: ["latest", false],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return DEGRADED_BLOCK;
    return blockFromRpc(await response.json()) ?? DEGRADED_BLOCK;
  } catch {
    return DEGRADED_BLOCK;
  }
}

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const defaultRunnerDeps = {
  clock: () => Math.floor(Date.now() / 1000),
  clientIp: () => "unconfigured",
  chain: {
    chainId: 11155111,
    permit2: ZERO,
    settlement: ZERO,
    domain: {
      name: "RivalSettlement",
      version: "1",
      chainId: 11155111,
      verifyingContract: ZERO,
    },
    faucet: ZERO,
    publisher: ZERO,
    tokens: { weth: ZERO, usdc: ZERO },
  },
  limits: {
    maxIntentsPerMaker: 5,
    intentWindowSec: 60,
    maxTokenClaimsPerIp: 3,
  },
  nonceUsed: async () => unconfigured("nonceUsed"),
  balanceOf: async () => unconfigured("balanceOf"),
  oracleQuote: async () => unconfigured("oracleQuote"),
  simulateFill: async () => unconfigured("simulateFill"),
  arkiv: {
    createEntity: async () => unconfigured("arkiv"),
  },
  publish: async () => unconfigured("publish"),
  mint: async () => unconfigured("mint"),
  ethRemaining: async () => unconfigured("ethRemaining"),
  verifyCancel: async () => unconfigured("verifyCancel"),
  relayCancel: async () => unconfigured("relayCancel"),
  probes: {
    block: readSepoliaBlock,
    oracle: async () => DEGRADED_ORACLE,
    bots: async () => ({ house: { ok: false, lastSeenAt: null } }),
    house: async () => ({ eth: "0", tWETH: "0", tUSDC: "0" }),
    arkiv: async () => DEGRADED_ARKIV,
    openIntents: async () => 0,
    lastFillAt: async () => null,
  },
} satisfies RunnerDeps;
