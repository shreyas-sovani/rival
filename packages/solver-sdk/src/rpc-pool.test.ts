import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createPublicClient } from "viem";
import { afterEach, describe, expect, it } from "vitest";
import { createRpcPool } from "./rpc-pool.ts";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

async function listen(handler: Handler): Promise<{ url: string; hits: () => number; close: () => Promise<void> }> {
  let hits = 0;
  const server = createServer((req, res) => {
    hits += 1;
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    hits: () => hits,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

function json(res: ServerResponse, status: number, body: unknown, extra?: Record<string, string>): void {
  res.writeHead(status, { "content-type": "application/json", ...extra });
  res.end(JSON.stringify(body));
}

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

describe("createRpcPool", () => {
  it("fails over a 500 and a timeout, and cools down a 429", async () => {
    const bad = await listen((_req, res) => {
      json(res, 500, { error: "down" });
    });
    const slow = await listen(() => {
      /* hang until the pool aborts */
    });
    const limited = await listen((_req, res) => {
      json(res, 429, { error: "slow" }, { "retry-after": "60" });
    });
    const good = await listen((_req, res) => {
      json(res, 200, { jsonrpc: "2.0", id: 1, result: "0x1" });
    });
    closers.push(bad.close, slow.close, limited.close, good.close);

    const failed = createRpcPool([bad.url, good.url], { timeoutMs: 200, cooldownMs: 1_000 });
    const client = createPublicClient({ transport: failed });
    expect(await client.request({ method: "eth_chainId" })).toBe("0x1");
    expect(failed.stats().rotations).toBe(1);
    expect(failed.stats().cooldowns).toBe(1);
    expect(bad.hits()).toBe(1);
    expect(good.hits()).toBe(1);

    const timed = createRpcPool([slow.url, good.url], { timeoutMs: 50, cooldownMs: 1_000 });
    const timedClient = createPublicClient({ transport: timed });
    expect(await timedClient.request({ method: "eth_chainId" })).toBe("0x1");
    expect(timed.stats().rotations).toBe(1);

    const cooled = createRpcPool([limited.url, good.url], { timeoutMs: 200, cooldownMs: 1_000 });
    const cooledClient = createPublicClient({ transport: cooled });
    expect(await cooledClient.request({ method: "eth_chainId" })).toBe("0x1");
    const hitsAfterFirst = limited.hits();
    expect(await cooledClient.request({ method: "eth_chainId" })).toBe("0x1");
    expect(limited.hits()).toBe(hitsAfterFirst);
    expect(cooled.stats().cooldowns).toBeGreaterThan(0);
  });

  it("round-robins healthy providers", async () => {
    const first = await listen((_req, res) => json(res, 200, { jsonrpc: "2.0", id: 1, result: "0x1" }));
    const second = await listen((_req, res) => json(res, 200, { jsonrpc: "2.0", id: 1, result: "0x2" }));
    closers.push(first.close, second.close);
    const pool = createRpcPool([first.url, second.url], { timeoutMs: 200, cooldownMs: 1_000 });
    const client = createPublicClient({ transport: pool });
    expect(await client.request({ method: "eth_chainId" })).toBe("0x1");
    expect(await client.request({ method: "eth_chainId" })).toBe("0x2");
    expect(first.hits()).toBe(1);
    expect(second.hits()).toBe(1);
    expect(pool.stats().rotations).toBe(0);
  });
});
