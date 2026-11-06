import { defaultRunnerDeps } from "../services/deps.ts";
import { createHandlers } from "./create.ts";
import type { Handlers } from "./types.ts";

/**
 * Live handlers. Effects come from `defaultRunnerDeps`.
 * Construction does not dial. A missing RPC or Arkiv client degrades the field when a handler calls it.
 * Tests build a separate set with `createHandlers` and do not call this object.
 */
export const handlers: Handlers = createHandlers(defaultRunnerDeps);

export { createHandlers };
