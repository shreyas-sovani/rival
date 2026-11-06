import { MAX_ORACLE_AGE_SEC } from "../handlers/health.ts";
import { NotImplemented } from "../handlers/types.ts";
import { readPresence } from "./arkiv.ts";
import { startLiveServices } from "../bots/live.ts";
import { defaultRunnerDeps } from "./deps.ts";

const PAIR = "tWETH/tUSDC";

/**
 * Boot the market-maker keep-alive, atlas, the house backstop, and two maker bots.
 * Does nothing unless `RUNNER_SERVICES=on`. Missing keys are logged by the loops.
 */
export async function startServices(): Promise<void> {
  if (process.env.RUNNER_SERVICES !== "on") return;
  startLiveServices();
}

/**
 * One readiness read. Exit 0 only when the oracle is fresh, presence is at least 1,
 * and the book has at least one open intent. Otherwise exit 1. Throws `NotImplemented`
 * unless `RUNNER_SERVICES=on`.
 */
export async function runCheck(): Promise<number> {
  if (process.env.RUNNER_SERVICES !== "on") {
    throw new NotImplemented("M-022");
  }
  try {
    const [oracle, presence, openIntents] = await Promise.all([
      defaultRunnerDeps.probes.oracle(),
      readPresence(PAIR).catch(() => 0),
      defaultRunnerDeps.probes.openIntents(),
    ]);
    const fresh = oracle.A.ageSec <= MAX_ORACLE_AGE_SEC && oracle.A.obs > 0;
    if (fresh && presence >= 1 && openIntents >= 1) return 0;
    return 1;
  } catch {
    return 1;
  }
}
