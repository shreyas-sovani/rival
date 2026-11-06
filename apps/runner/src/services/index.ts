import { runCheck as runLocalCycle } from "../bots/check.ts";
import { NotImplemented } from "../handlers/types";

/** Boot indexer, market maker, maker bots, and solver bots. Not this cycle. */
export async function startServices(): Promise<void> {
  throw new NotImplemented("M-022");
}

/**
 * One local Sepolia read. Exit 0 when the hook returns a timestamp, 1 when
 * the RPC is unset or the call reverts. Throws `NotImplemented` unless
 * `RUNNER_SERVICES=on`. The server's `--check` flag exits 3 on that throw.
 * This is not the hosted soak (H-004, H-008).
 */
export async function runCheck(): Promise<number> {
  if (process.env.RUNNER_SERVICES !== "on") {
    throw new NotImplemented("M-022");
  }
  return runLocalCycle();
}
