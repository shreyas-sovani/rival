import { defaultRunnerDeps } from "../services/deps.ts";
import { createHandlers } from "./create.ts";
import type { Handlers } from "./types.ts";

/**
 * Live handlers. Effects come from `defaultRunnerDeps`, which never dials a network.
 * Tests build a separate set with `createHandlers` and do not call this object.
 */
export const handlers: Handlers = createHandlers(defaultRunnerDeps);

export { createHandlers };
