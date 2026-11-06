import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configValue, loadConfig, type RunnerConfig } from "./config.ts";
import { openDatabase, resolveSqlitePath } from "./db.ts";
import { NotImplemented } from "./handlers/types.ts";
import { logger } from "./logger.ts";
import { stripCookies } from "./middleware/cookies.ts";
import { corsMiddleware } from "./middleware/cors.ts";
import { bindRateLimit } from "./middleware/rate-limit.ts";
import { registerRoutes } from "./routes/index.ts";
import { acceptHealth, acceptPost, acceptStream, SMOKE_CALLS } from "./routes/smoke.ts";
import { runCheck, startServices } from "./services/index.ts";

const PORT = 8080;
const SMOKE_ORIGIN = "http://localhost:3000";

export function createApp(config: RunnerConfig): Hono {
  const origin = configValue(config, "ALLOWED_ORIGIN");
  const app = new Hono();
  app.use("*", stripCookies());
  app.use("*", corsMiddleware(origin));
  registerRoutes(app);
  return app;
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function runSmoke(app: Hono): Promise<number> {
  const failures: string[] = [];
  for (const call of SMOKE_CALLS) {
    const controller = new AbortController();
    const headers = new Headers();
    if (call.body !== undefined) headers.set("content-type", "application/json");
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const response = await app.request(call.path, {
        method: call.method,
        headers,
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
        signal: controller.signal,
      });
      let accepted = false;
      if (call.path === "/api/intents/stream") {
        const contentType = response.headers.get("content-type");
        const payload = response.status === 200 ? null : await readPayload(response);
        accepted = acceptStream(response.status, contentType, payload);
      } else {
        const payload = await readPayload(response);
        accepted =
          call.path === "/api/health"
            ? acceptHealth(response.status, payload)
            : acceptPost(call.path, response.status, payload);
      }
      if (!accepted) failures.push(`${call.method} ${call.path} status=${response.status}`);
      await response.body?.cancel().catch(() => undefined);
    } catch (err) {
      const message = err instanceof Error ? err.name : "error";
      failures.push(`${call.method} ${call.path} ${message}`);
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }
  if (failures.length > 0) {
    logger.error({ failures }, "smoke failed");
    return 1;
  }
  return 0;
}

async function check(): Promise<number> {
  try {
    return await runCheck();
  } catch (err) {
    if (err instanceof NotImplemented) return 3;
    throw err;
  }
}

/**
 * Route smoke does not need chain secrets. A missing runner env still boots
 * with a local CORS origin so health can report degraded and POST bodies can
 * fail validation. A valid env is used as-is.
 */
function smokeConfig(): RunnerConfig {
  try {
    return loadConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.startsWith("runner env invalid")) throw err;
    logger.warn({}, message);
    return { ALLOWED_ORIGIN: SMOKE_ORIGIN };
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--check")) {
    process.exit(await check());
  }

  const config = argv.includes("--smoke") ? smokeConfig() : loadConfig();
  const db = openDatabase(resolveSqlitePath());
  bindRateLimit(db);
  const app = createApp(config);

  if (argv.includes("--smoke")) {
    const code = await runSmoke(app);
    db.close();
    process.exit(code);
  }

  if (process.env.RUNNER_SERVICES === "on") {
    try {
      await startServices();
    } catch (err) {
      if (err instanceof NotImplemented) {
        logger.error({}, "startServices is not implemented");
        process.exit(3);
      }
      throw err;
    }
  }

  serve({ fetch: app.fetch, hostname: "0.0.0.0", port: PORT }, (info) => {
    logger.info({ port: info.port }, "runner listening");
  });
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === fileURLToPath(import.meta.url);
}

if (invokedDirectly()) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "runner failed";
    logger.error({ name: err instanceof Error ? err.name : "Error" }, message);
    process.exit(err instanceof NotImplemented ? 3 : 1);
  });
}
