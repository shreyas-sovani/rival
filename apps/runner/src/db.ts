import { accessSync, constants, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

export type RunnerDb = Database.Database;

/** Fly volume mount. Local processes without that mount use a temp file. */
export const FLY_SQLITE_PATH = "/data/runner.sqlite";

export function resolveSqlitePath(): string {
  try {
    accessSync("/data", constants.W_OK);
    return FLY_SQLITE_PATH;
  } catch {
    const dir = join(tmpdir(), "rival-runner");
    mkdirSync(dir, { recursive: true });
    return join(dir, "runner.sqlite");
  }
}

export function openDatabase(path: string): RunnerDb {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (key, window_start)
    );
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

export function kvGet(db: RunnerDb, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function kvSet(db: RunnerDb, key: string, value: string): void {
  db.prepare(
    `INSERT INTO kv (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

/** Fixed window. Returns false when `limit` is already reached. The caller supplies every parameter. */
export function takeFixedWindow(
  db: RunnerDb,
  key: string,
  limit: number,
  windowSec: number,
  nowMs: number = Date.now(),
): boolean {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("rate limit must be a positive integer");
  }
  if (!Number.isInteger(windowSec) || windowSec < 1) {
    throw new Error("rate window must be a positive integer");
  }
  const nowSec = Math.floor(nowMs / 1000);
  const windowStart = nowSec - (nowSec % windowSec);
  const run = db.transaction((): boolean => {
    db.prepare("DELETE FROM rate_limits WHERE key = ? AND window_start < ?").run(key, windowStart);
    const row = db.prepare("SELECT count FROM rate_limits WHERE key = ? AND window_start = ?").get(key, windowStart) as
      | { count: number }
      | undefined;
    if ((row?.count ?? 0) >= limit) return false;
    db.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`,
    ).run(key, windowStart);
    return true;
  });
  return run();
}
