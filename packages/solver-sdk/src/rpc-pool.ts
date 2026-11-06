import { custom, type Transport } from "viem";

export type RpcPoolOptions = {
  timeoutMs: number;
  cooldownMs: number;
};

export type RpcPoolStats = {
  requests: number;
  rotations: number;
  cooldowns: number;
  failures: number;
};

type Attempt =
  | { kind: "ok"; result: unknown }
  | { kind: "rotate"; retryAfter: string | null }
  | { kind: "fail"; error: Error };

function retryAfterMs(header: string | null, fallback: number): number {
  if (!header) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(header);
  if (Number.isNaN(when)) return fallback;
  return Math.max(0, when - Date.now());
}

export function createRpcPool(urls: readonly string[], options: RpcPoolOptions): Transport & {
  stats: () => RpcPoolStats;
} {
  if (urls.length === 0) throw new Error("rpc urls required");
  const cooled = new Map<string, number>();
  const counts: RpcPoolStats = { requests: 0, rotations: 0, cooldowns: 0, failures: 0 };
  let cursor = 0;

  function pick(now: number): string | undefined {
    for (let offset = 0; offset < urls.length; offset += 1) {
      const index = (cursor + offset) % urls.length;
      const url = urls[index];
      if (!url) continue;
      if ((cooled.get(url) ?? 0) <= now) {
        cursor = (index + 1) % urls.length;
        return url;
      }
    }
    return undefined;
  }

  async function attempt(url: string, method: string, params: unknown): Promise<Attempt> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
        signal: controller.signal,
      });
      if (response.status === 429 || response.status >= 500) {
        return { kind: "rotate", retryAfter: response.headers.get("retry-after") };
      }
      if (!response.ok) return { kind: "fail", error: new Error(`rpc http ${response.status}`) };
      const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
      if (body.error) return { kind: "fail", error: new Error(body.error.message ?? "rpc error") };
      return { kind: "ok", result: body.result };
    } catch {
      return { kind: "rotate", retryAfter: null };
    } finally {
      clearTimeout(timer);
    }
  }

  async function send(method: string, params: unknown): Promise<unknown> {
    counts.requests += 1;
    for (let i = 0; i < urls.length; i += 1) {
      const url = pick(Date.now());
      if (!url) break;
      const result = await attempt(url, method, params);
      if (result.kind === "ok") return result.result;
      if (result.kind === "fail") throw result.error;
      counts.failures += 1;
      counts.cooldowns += 1;
      cooled.set(url, Date.now() + retryAfterMs(result.retryAfter, options.cooldownMs));
      if (i < urls.length - 1) counts.rotations += 1;
    }
    throw new Error("rpc pool exhausted");
  }

  const transport = custom({
    name: "rivalRpcPool",
    retryCount: 0,
    async request({ method, params }) {
      return send(method, params);
    },
  });
  return Object.assign(transport, {
    stats: () => ({ ...counts }),
  });
}
