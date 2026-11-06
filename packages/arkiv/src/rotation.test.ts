import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createRotatingFetch, type FetchLike } from "./rotation.ts";

const keys = ["key-a", "key-b"] as const;
const logs: string[] = [];
const originals = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

function spy(): void {
  logs.length = 0;
  const push = (...args: unknown[]) => {
    logs.push(args.map((item) => String(item)).join(" "));
  };
  console.log = push;
  console.info = push;
  console.warn = push;
  console.error = push;
  console.debug = push;
}

function restore(): void {
  console.log = originals.log;
  console.info = originals.info;
  console.warn = originals.warn;
  console.error = originals.error;
  console.debug = originals.debug;
}

function fake(statusFor: (key: string) => number): { fetch: FetchLike; seen: string[] } {
  const seen: string[] = [];
  const fetch: FetchLike = async (_input, init) => {
    const key = new Headers(init?.headers).get("X-API-KEY") ?? "";
    seen.push(key);
    const status = statusFor(key);
    if (status === 200) {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("no", { status, headers: { "retry-after": "60" } });
  };
  return { fetch, seen };
}

describe("createRotatingFetch", () => {
  afterEach(() => restore());

  it("switches keys on 429 and 401 and keeps them out of logs", async () => {
    spy();
    const first = fake((key) => (key === "key-a" ? 429 : 200));
    const rotating = createRotatingFetch(keys, first.fetch, { cooldownMs: 60_000, baseMs: 1, maxMs: 2 });
    const response = await rotating("https://rpc.example/key-a", { method: "POST" });
    expect(response.status).toBe(200);
    expect(first.seen).toEqual(["key-a", "key-b"]);

    const second = fake((key) => (key === "key-b" ? 401 : 200));
    const again = createRotatingFetch(["key-b", "key-a"], second.fetch, { cooldownMs: 60_000, baseMs: 1, maxMs: 2 });
    expect((await again("https://rpc.example/key-b")).status).toBe(200);
    expect(second.seen).toEqual(["key-b", "key-a"]);

    const text = logs.join("\n");
    expect(text.includes("key-a")).toBe(false);
    expect(text.includes("key-b")).toBe(false);
  });

  it("cools a rejected key down for the next call", async () => {
    const seen: string[] = [];
    let calls = 0;
    const fetch: FetchLike = async (_input, init) => {
      const key = new Headers(init?.headers).get("X-API-KEY") ?? "";
      seen.push(key);
      calls += 1;
      if (calls === 1) return new Response("no", { status: 429, headers: { "retry-after": "60" } });
      return new Response("ok", { status: 200 });
    };
    const rotating = createRotatingFetch(keys, fetch, { cooldownMs: 60_000, baseMs: 1, maxMs: 2 });
    await rotating("https://rpc.example/key-a");
    await rotating("https://rpc.example/key-a");
    expect(seen).toEqual(["key-a", "key-b", "key-b"]);
  });

  it("serves a local HTTP server through the rotated header", async () => {
    const seen: string[] = [];
    const server = createServer((req, res) => {
      seen.push(req.headers["x-api-key"]?.toString() ?? "");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    try {
      const rotating = createRotatingFetch(keys, fetch, { baseMs: 1, maxMs: 2 });
      const response = await rotating(`http://127.0.0.1:${address.port}/key-a`);
      expect(response.status).toBe(200);
      expect(seen).toEqual(["key-a"]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
