import { afterEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createArkivClients } from "./client.ts";
import type { FetchLike } from "./rotation.ts";

const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
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

afterEach(() => {
  console.log = originals.log;
  console.info = originals.info;
  console.warn = originals.warn;
  console.error = originals.error;
  console.debug = originals.debug;
});

function durationOf(value: unknown): number {
  if (!value || typeof value !== "object" || !("duration" in value) || typeof value.duration !== "number") {
    throw new Error("missing timing");
  }
  return value.duration;
}

function rpc(statusFor: (key: string) => number): { transport: FetchLike; seen: string[] } {
  const seen: string[] = [];
  const transport: FetchLike = async (_input, init) => {
    const key = new Headers(init?.headers).get("X-API-KEY") ?? "";
    seen.push(key);
    const raw = typeof init?.body === "string" ? init.body : new TextDecoder().decode(init?.body as ArrayBuffer);
    const payload = JSON.parse(raw) as { id?: number };
    const status = statusFor(key);
    if (status !== 200) return new Response("no", { status, headers: { "retry-after": "60" } });
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: payload.id ?? 1,
        result: { current_block: "0x1", current_block_time: 1, duration: 1 },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };
  return { transport, seen };
}

describe("createArkivClients", () => {
  it("rotates the read client off 429 and 401 without logging keys", async () => {
    spy();
    const denied = rpc((key) => (key === "key-a" ? 429 : 200));
    const clients = createArkivClients({ readKeys: ["key-a", "key-b"], transport: denied.transport });
    const result = await clients.read.request({ method: "arkiv_getBlockTiming", params: [] });
    expect(durationOf(result)).toBe(1);
    expect(denied.seen[0]).toBe("key-a");
    expect(denied.seen).toContain("key-b");

    const unauthorized = rpc((key) => (key === "key-a" ? 401 : 200));
    const second = createArkivClients({ readKeys: ["key-a", "key-b"], transport: unauthorized.transport });
    expect(durationOf(await second.read.request({ method: "arkiv_getBlockTiming", params: [] }))).toBe(1);
    expect(unauthorized.seen).toContain("key-b");

    const text = logs.join("\n");
    expect(text.includes("key-a")).toBe(false);
    expect(text.includes("key-b")).toBe(false);
    expect(text.includes("write-key")).toBe(false);
  });

  it("stamps the write key on the wallet client", async () => {
    const seen: string[] = [];
    const transport: FetchLike = async (_input, init) => {
      seen.push(new Headers(init?.headers).get("X-API-KEY") ?? "");
      const raw = typeof init?.body === "string" ? init.body : "{}";
      const payload = JSON.parse(raw) as { id?: number };
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: payload.id ?? 1,
          result: { current_block: "0x1", current_block_time: 1, duration: 1 },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    };
    const { wallet } = createArkivClients({ readKeys: ["key-a"], writeKey: "write-key", transport });
    const account = privateKeyToAccount(ANVIL_KEY);
    const client = wallet(account);
    expect(durationOf(await client.request({ method: "arkiv_getBlockTiming", params: [] }))).toBe(1);
    expect(seen).toEqual(["write-key"]);
  });
});
