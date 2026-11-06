import type { MiddlewareHandler } from "hono";
import { takeFixedWindow, type RunnerDb } from "../db.ts";
import { json } from "./http.ts";

let database: RunnerDb | undefined;

export function bindRateLimit(db: RunnerDb): void {
  database = db;
}

/**
 * Fixed-window limiter. `key`, `limit`, and `windowSec` are supplied by the caller.
 * This middleware does not choose them.
 */
export function rateLimit(key: string, limit: number, windowSec: number): MiddlewareHandler {
  return async (_c, next) => {
    const db = database;
    if (!db) throw new Error("rate limit database is not open");
    if (!takeFixedWindow(db, key, limit, windowSec)) {
      return json({ code: "RATE_LIMITED", message: "rate limit exceeded" }, 429);
    }
    await next();
  };
}
