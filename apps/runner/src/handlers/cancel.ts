import type { RunnerDeps } from "../services/deps.ts";
import { ApiError, type CancelRequest, type CancelResponse } from "./types.ts";

/** Relays `cancelBySig`. The checker and the relayer are injected; this function sends nothing. */
export async function cancel(deps: RunnerDeps, req: CancelRequest): Promise<CancelResponse> {
  const ok = await deps.verifyCancel(req);
  if (!ok) {
    throw new ApiError("INVALID_SIGNATURE", "cancel signature does not recover");
  }
  const txHash = await deps.relayCancel(req);
  return { txHash };
}
