import { NotImplemented } from "../handlers/types";

/** Boot indexer, market maker, maker bots, and solver bots. Stub until M-022. */
export async function startServices(): Promise<void> {
  throw new NotImplemented("M-022");
}

/**
 * One full cycle against Sepolia. Exit code 0 means the cycle succeeded.
 * Stub until M-022. The server's `--check` flag exits 3 when this throws `NotImplemented`.
 */
export async function runCheck(): Promise<number> {
  throw new NotImplemented("M-022");
}
