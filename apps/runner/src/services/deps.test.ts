import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_BLOCK_LAG_SEC, MAX_ORACLE_AGE_SEC } from "../handlers/health.ts";
import { createApp } from "../server.ts";
import { schemas } from "../routes/schema.ts";

const FAKE_RPC = "http://127.0.0.1:9/sepolia";
const hasSepoliaRpc = Boolean(process.env.SEPOLIA_RPC_URL?.trim());

function healthApp() {
  return createApp({ ALLOWED_ORIGIN: "http://localhost:3000" });
}

function isHealthBody(body: unknown): body is { status: "ok" | "degraded"; block: { number: string } } {
  if (!body || typeof body !== "object") return false;
  const status = (body as { status?: unknown }).status;
  const number = (body as { block?: { number?: unknown } }).block?.number;
  return (status === "ok" || status === "degraded") && typeof number === "string";
}

async function getHealth(): Promise<{ status: number; body: unknown }> {
  const response = await healthApp().request("/api/health");
  return { status: response.status, body: await response.json() };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("returns 503 with a degraded block when SEPOLIA_RPC_URL is absent", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", "");
    const fetchMock = vi.fn(() => {
      throw new Error("rpc should not be called");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { status, body } = await getHealth();

    expect(status).toBe(503);
    expect(schemas.Health.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      status: "degraded",
      block: { number: "0", lagSec: MAX_BLOCK_LAG_SEC + 1 },
      oracle: { A: { ageSec: MAX_ORACLE_AGE_SEC + 1, obs: 0 } },
      bots: { house: { ok: false, lastSeenAt: null } },
      house: { eth: "0", tWETH: "0", tUSDC: "0" },
      arkiv: { ok: false, latencyMs: 0 },
      openIntents: 0,
      lastFillAt: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("puts the rpc head in the health body and stays 503 while other probes are down", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", FAKE_RPC);
    const now = Math.floor(Date.now() / 1000);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url !== FAKE_RPC) throw new Error("unexpected rpc host");
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { number: "0x64", timestamp: `0x${now.toString(16)}` },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const { status, body } = await getHealth();

    expect(status).toBe(503);
    expect(schemas.Health.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      status: "degraded",
      block: { number: "100" },
      arkiv: { ok: false, latencyMs: 0 },
    });
  });

  it("degrades the block when the rpc call throws instead of returning 500", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", FAKE_RPC);
    vi.stubGlobal("fetch", () => {
      throw new Error("runner dependency block is not configured");
    });

    const { status, body } = await getHealth();

    expect(status).toBe(503);
    expect(schemas.Health.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      status: "degraded",
      block: { number: "0", lagSec: MAX_BLOCK_LAG_SEC + 1 },
    });
  });

  it.skipIf(!hasSepoliaRpc)("includes the live sepolia head when SEPOLIA_RPC_URL is set", async () => {
    const { status, body } = await getHealth();
    expect(schemas.Health.safeParse(body).success).toBe(true);
    if (!isHealthBody(body)) throw new Error("health body invalid");
    expect(status).toBe(body.status === "ok" ? 200 : 503);
    const reported = BigInt(body.block.number);
    const head = await readHeadNumber();
    expect(reported > 0n).toBe(true);
    expect(reported <= head).toBe(true);
    expect(head - reported <= 5n).toBe(true);
  });
});

async function readHeadNumber(): Promise<bigint> {
  const rpc = process.env.SEPOLIA_RPC_URL?.trim();
  if (!rpc) throw new Error("sepolia head read failed");
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload: unknown = await response.json();
    const result = payload && typeof payload === "object" ? (payload as { result?: unknown }).result : undefined;
    if (typeof result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result)) throw new Error("missing head");
    return BigInt(result);
  } catch {
    throw new Error("sepolia head read failed");
  }
}
