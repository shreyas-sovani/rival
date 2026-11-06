import type { Hono } from "hono";
import { registerBook } from "./book.ts";
import { registerCancel } from "./cancel.ts";
import { registerFaucet } from "./faucet.ts";
import { registerHealth } from "./health.ts";
import { registerIntents } from "./intents.ts";
import { registerStream } from "./stream.ts";

export function registerRoutes(app: Hono): void {
  registerHealth(app);
  registerFaucet(app);
  registerIntents(app);
  registerBook(app);
  registerCancel(app);
  registerStream(app);
}
