import { ExpirationTime } from "@arkiv-network/sdk";
import { addr } from "@arkiv-network/sdk/schema";
import { createArkivClients } from "../../arkiv/src/client.ts";
import { buildIntentQuery, MAX_PAGE_SIZE, assertPageSize } from "../../arkiv/src/queries.ts";
import { PAIR, SolverPresence } from "../../arkiv/src/schemas.ts";
import { createPublicClient, createWalletClient, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { PERMIT2, rivalDeployment } from "./deployment.ts";
import { createLiveSolverPorts, runSolverLoop } from "./live.ts";
import type { ArkivOpenBook } from "./ports.ts";
import { createRpcPool } from "./rpc-pool.ts";
import type { PresencePort, RunSolverPorts, StrategyId } from "./run.ts";
import { payloadText } from "./book.ts";
import { readIntent } from "./verify.ts";
import { verifyWitness } from "./witness.ts";

const STRATEGIES = ["sprint", "patient", "arb", "inventory", "house"] as const;

export interface SolverConfig {
  label: string;
  key: Hex;
  rpc: string;
  strategy?: StrategyId;
}

export interface RunSolverDeps {
  ports?: RunSolverPorts;
  signal?: AbortSignal;
  intervalMs?: number;
}

function isStrategy(value: unknown): value is StrategyId {
  return typeof value === "string" && (STRATEGIES as readonly string[]).includes(value);
}

/** True for `{ label, key, rpc }`. A port bag is not a config. */
export function isSolverConfig(value: unknown): value is SolverConfig {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.label !== "string" || record.label.trim() === "") return false;
  if (typeof record.rpc !== "string" || record.rpc.trim() === "") return false;
  if (typeof record.key !== "string" || !/^0x[0-9a-fA-F]+$/.test(record.key)) return false;
  if ("book" in record || "quoter" in record || "submitter" in record) return false;
  if (record.strategy !== undefined && !isStrategy(record.strategy)) return false;
  return true;
}

function strategyOf(value: StrategyId | undefined): StrategyId {
  return value ?? "sprint";
}

function readKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.ARKIV_ACCESS_KEYS_READ;
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  const write = env.ARKIV_ACCESS_KEY_WRITE?.trim();
  return write ? [write] : [];
}

function entitiesOf(page: unknown): unknown[] {
  if (!page || typeof page !== "object") return [];
  const entities = (page as { entities?: unknown }).entities;
  return Array.isArray(entities) ? entities : [];
}

const PRESENCE_MINUTES = 3;

async function queryOpen(client: { query: (query: string, options?: { limit?: number }) => Promise<unknown> }, now: bigint) {
  const limit = MAX_PAGE_SIZE;
  assertPageSize(limit);
  const query = buildIntentQuery({ now: Number(now), pair: PAIR, status: "open", sortDeadlineAsc: true });
  return client.query(query, { limit });
}

function openBook(): ArkivOpenBook {
  return {
    listOpen: async (now) => {
      const keys = readKeys();
      if (keys.length === 0) throw new Error("arkiv reader is not configured");
      const writeKey = process.env.ARKIV_ACCESS_KEY_WRITE?.trim();
      const client = createArkivClients({
        readKeys: keys,
        ...(writeKey ? { writeKey } : {}),
      }).read;
      const page = await queryOpen(client, now);
      const deployment = rivalDeployment();
      const rows: { intentJson: string; signature: Hex }[] = [];
      for (const entity of entitiesOf(page)) {
        const text = payloadText(entity);
        if (!text) continue;
        try {
          const parsed: unknown = JSON.parse(text);
          if (!parsed || typeof parsed !== "object") continue;
          const body = parsed as { intent?: unknown; signature?: unknown };
          const intent = readIntent(body.intent);
          if (!intent || typeof body.signature !== "string" || !body.signature.startsWith("0x")) continue;
          const verdict = await verifyWitness({
            intent,
            signature: body.signature as Hex,
            permit2: PERMIT2,
            settlement: deployment.settlement,
            chainId: deployment.chainId,
          });
          if (!verdict.accept) continue;
          rows.push({
            intentJson: JSON.stringify({
              ...intent,
              amountIn: intent.amountIn.toString(),
              baseOut: intent.baseOut.toString(),
              hardMinOut: intent.hardMinOut.toString(),
              nonce: intent.nonce.toString(),
            }),
            signature: body.signature as Hex,
          });
        } catch {
          continue;
        }
      }
      return rows;
    },
  };
}

function presenceFor(account: Address, label: string, key: Hex, strategy: StrategyId): PresencePort {
  let entityKey: Hex | undefined;
  let last = 0n;
  return {
    lastExtend: async () => last,
    extend: async (now) => {
      const keys = readKeys();
      const writeKey = process.env.ARKIV_ACCESS_KEY_WRITE?.trim();
      if (keys.length === 0 || !writeKey) throw new Error("arkiv writer is not configured");
      const client = createArkivClients({
        readKeys: keys,
        writeKey,
        transport: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(8_000) }),
      }).wallet(privateKeyToAccount(key));
      const expiration = ExpirationTime.fromMinutes(PRESENCE_MINUTES);
      if (entityKey !== undefined) {
        const extended = await client.extendEntity({ entityKey, expiration });
        entityKey = extended.entityKey as Hex;
      } else {
        const created = await client.createEntity(
          SolverPresence,
          {
            solver: addr(account),
            ensName: `${label}.solvers.rival.eth`,
            pair: PAIR,
            maxAmountIn: 10n ** 18n,
            strategy,
            version: "0.0.0",
          },
          { expiration },
        );
        entityKey = created.entityKey as Hex;
      }
      last = now;
    },
  };
}

/** Viem clients, Arkiv book, and presence for one solver process. */
export function buildLivePorts(config: SolverConfig): RunSolverPorts {
  const deployment = rivalDeployment();
  const account = privateKeyToAccount(config.key);
  const urls = [config.rpc];
  for (const name of ["SEPOLIA_RPC_URL_2", "SEPOLIA_RPC_URL_3"] as const) {
    const extra = process.env[name]?.trim();
    if (extra && !urls.includes(extra)) urls.push(extra);
  }
  const transport = createRpcPool(urls, { timeoutMs: 8_000, cooldownMs: 2_000 });
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });
  const strategy = strategyOf(config.strategy);
  return createLiveSolverPorts({
    publicClient,
    walletClient,
    account,
    chainId: deployment.chainId,
    settlement: deployment.settlement,
    permit2: PERMIT2,
    uniswapSolver: deployment.uniswapSolver,
    hook: deployment.hook,
    poolA: deployment.poolA,
    poolB: deployment.poolB,
    book: openBook(),
    presence: presenceFor(account.address, config.label, config.key, strategy),
    strategy,
  });
}

function runUntilStop(ports: RunSolverPorts, deps?: RunSolverDeps): Promise<void> {
  return new Promise((resolve) => {
    const loop = runSolverLoop(ports, {
      intervalMs: deps?.intervalMs ?? 8_000,
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
      },
    });
    let settled = false;
    const stop = () => {
      if (settled) return;
      settled = true;
      loop.stop();
      deps?.signal?.removeEventListener("abort", stop);
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };
    if (deps?.signal) deps.signal.addEventListener("abort", stop);
    else {
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    }
  });
}

/**
 * Package entry. Blocks on the live loop until SIGINT, SIGTERM, or an injected abort signal.
 * Pass `ports` in tests so this does not open a socket.
 */
export async function runSolver(config: SolverConfig, deps?: RunSolverDeps): Promise<void> {
  if (!isSolverConfig(config)) throw new Error("solver config requires label, key, and rpc");
  if (deps?.signal?.aborted) return;
  const ports = deps?.ports ?? buildLivePorts(config);
  await runUntilStop(ports, deps);
}
