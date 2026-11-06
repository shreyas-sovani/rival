import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runnerEnvNames } from "../config.ts";
import { createApp, runSmoke } from "../server.ts";
import { acceptHealth, acceptPost, acceptStream } from "./smoke.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function runnerEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of runnerEnvNames()) delete env[name];
  delete env.RUNNER_SERVICES;
  return env;
}

function runCli(arg: "--smoke" | "--check"): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "apps/runner/src/server.ts", arg], {
      cwd: root,
      env: runnerEnv(),
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", (code) => resolveExit(code ?? 1));
  });
}

describe("runner smoke", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts implemented health, validation errors, and the stream", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", "");
    const app = createApp({ ALLOWED_ORIGIN: "http://localhost:3000" });

    const health = await app.request("/api/health");
    const healthBody: unknown = await health.json();
    expect(health.status).toBe(503);
    expect(acceptHealth(health.status, healthBody)).toBe(true);

    for (const path of ["/api/faucet", "/api/intents", "/api/cancel"] as const) {
      const response = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body: unknown = await response.json();
      expect(response.status).toBe(400);
      expect(acceptPost(path, response.status, body)).toBe(true);
    }

    const controller = new AbortController();
    const stream = await app.request("/api/intents/stream", { signal: controller.signal });
    expect(stream.status).toBe(200);
    expect(acceptStream(stream.status, stream.headers.get("content-type"), null)).toBe(true);
    controller.abort();
    await stream.body?.cancel();

    expect(await runSmoke(app)).toBe(0);
  });

  it("exits 0 when runner env is unset", async () => {
    expect(await runCli("--smoke")).toBe(0);
  }, 20_000);

  it("check exits 3 when runCheck throws NotImplemented", async () => {
    expect(await runCli("--check")).toBe(3);
  }, 20_000);
});
