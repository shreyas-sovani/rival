import type { RunnerDeps } from "../services/deps.ts";
import type { BotHealth, HealthRequest, HealthResponse, OraclePoolHealth } from "./types.ts";

/** A block older than this is degraded. Sepolia blocks are ~12s; 30s is a couple of missed blocks. */
export const MAX_BLOCK_LAG_SEC = 30;

/** Oracle age above this is stale. Matches the two-minute freshness window in FR-RUN-03. */
export const MAX_ORACLE_AGE_SEC = 120;

function freshBlock(block: HealthResponse["block"]): boolean {
  return Number.isInteger(block.lagSec) && block.lagSec >= 0 && block.lagSec <= MAX_BLOCK_LAG_SEC;
}

function freshPool(pool: OraclePoolHealth): boolean {
  return Number.isInteger(pool.ageSec) && pool.ageSec >= 0 && pool.ageSec <= MAX_ORACLE_AGE_SEC;
}

function freshOracle(oracle: { A: OraclePoolHealth; B?: OraclePoolHealth }): boolean {
  if (!freshPool(oracle.A)) return false;
  if (oracle.B !== undefined && !freshPool(oracle.B)) return false;
  return true;
}

function freshBots(bots: Record<string, BotHealth>): boolean {
  return Object.values(bots).every((bot) => bot.ok);
}

function funded(amount: string): boolean {
  return /^[0-9]+$/.test(amount) && BigInt(amount) > 0n;
}

function freshHouse(house: HealthResponse["house"]): boolean {
  return funded(house.eth) && funded(house.tWETH) && funded(house.tUSDC);
}

/** `ok` only when lag, oracle age, every bot, house balances, and Arkiv are all healthy. */
export async function health(deps: RunnerDeps, req: HealthRequest): Promise<HealthResponse> {
  void req;
  const [block, oracle, bots, house, arkiv, openIntents, lastFillAt] = await Promise.all([
    deps.probes.block(),
    deps.probes.oracle(),
    deps.probes.bots(),
    deps.probes.house(),
    deps.probes.arkiv(),
    deps.probes.openIntents(),
    deps.probes.lastFillAt(),
  ]);
  const status =
    freshBlock(block) && freshOracle(oracle) && freshBots(bots) && freshHouse(house) && arkiv.ok
      ? "ok"
      : "degraded";
  return { status, block, oracle, bots, house, arkiv, openIntents, lastFillAt };
}
