import type { PublishIntentInput } from "@rival/arkiv";
import type { Address as IntentAddress, Intent, IntentDomain } from "@rival/intent";
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
 * `defaultRunnerDeps` throws instead of dialing Sepolia, Arkiv, or reading env.
 * Tests pass their own object and never call the default.
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
    block: async () => unconfigured("block"),
    oracle: async () => unconfigured("oracle"),
    bots: async () => unconfigured("bots"),
    house: async () => unconfigured("house"),
    arkiv: async () => unconfigured("arkivProbe"),
    openIntents: async () => unconfigured("openIntents"),
    lastFillAt: async () => unconfigured("lastFillAt"),
  },
} satisfies RunnerDeps;
