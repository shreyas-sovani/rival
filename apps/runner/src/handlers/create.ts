import { DegradedFeed } from "../services/degraded-feed.ts";
import type { RunnerDeps } from "../services/deps.ts";
import { FaucetClaims, MakerRateLimit } from "../services/limits.ts";
import { cancel } from "./cancel.ts";
import { faucet } from "./faucet.ts";
import { health } from "./health.ts";
import { intents } from "./intents.ts";
import { stream } from "./stream.ts";
import type { Handlers } from "./types.ts";

/** Handlers closed over one deps object. Each call gets its own rate-limit and degraded-feed state. */
export function createHandlers(deps: RunnerDeps): Handlers {
  const feed = new DegradedFeed();
  const intentLimit = new MakerRateLimit(deps.limits.maxIntentsPerMaker, deps.limits.intentWindowSec, deps.clock);
  const claims = new FaucetClaims(deps.limits.maxTokenClaimsPerIp);
  return {
    health: (req) => health(deps, req),
    faucet: (req) => faucet(deps, claims, req),
    intents: (req) => intents(deps, intentLimit, feed, req),
    cancel: (req) => cancel(deps, req),
    stream: (req) => stream(feed, req),
  };
}
