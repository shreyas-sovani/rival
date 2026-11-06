export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type RotationOptions = {
  cooldownMs?: number;
  baseMs?: number;
  maxMs?: number;
};

const DEFAULTS = { cooldownMs: 30_000, baseMs: 20, maxMs: 500 };

function retryAfterMs(header: string | null, fallback: number): number {
  if (!header) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(header);
  if (Number.isNaN(when)) return fallback;
  return Math.max(0, when - Date.now());
}

export function stampKey(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  key: string,
  knownKeys: readonly string[],
): { input: URL; init: RequestInit } {
  const raw = typeof input === "string" || input instanceof URL ? input : input.url;
  const url = new URL(raw);
  const known = new Set(knownKeys.flatMap((item) => [item, encodeURIComponent(item)]));
  const parts = url.pathname.split("/");
  const last = parts[parts.length - 1] ?? "";
  if (last.length > 0 && known.has(last)) {
    parts[parts.length - 1] = encodeURIComponent(key);
    url.pathname = parts.join("/");
  }
  const headers = new Headers(
    init?.headers ?? (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined),
  );
  headers.set("X-API-KEY", key);
  return { input: url, init: { ...init, headers } };
}

/**
 * Round-robin read keys. HTTP 401 and 429 cool a key down.
 * Delays double from `baseMs` up to `maxMs`. The generic helper lives in
 * `packages/solver-sdk/src/retry.ts`; this package does not import it.
 */
export function createRotatingFetch(
  keys: readonly string[],
  base: FetchLike,
  options?: RotationOptions,
): FetchLike {
  if (keys.length === 0) throw new Error("readKeys required");
  const cooldownMs = options?.cooldownMs ?? DEFAULTS.cooldownMs;
  const baseMs = options?.baseMs ?? DEFAULTS.baseMs;
  const maxMs = options?.maxMs ?? DEFAULTS.maxMs;
  const cooled = new Map<string, number>();
  let cursor = 0;

  function pick(now: number): string | undefined {
    for (let offset = 0; offset < keys.length; offset += 1) {
      const index = (cursor + offset) % keys.length;
      const key = keys[index];
      if (!key) continue;
      if ((cooled.get(key) ?? 0) <= now) {
        cursor = (index + 1) % keys.length;
        return key;
      }
    }
    return undefined;
  }

  return async (input, init) => {
    let lastStatus = 0;
    for (let attempt = 0; attempt < keys.length; attempt += 1) {
      const key = pick(Date.now());
      if (!key) break;
      const stamped = stampKey(input, init, key, keys);
      const response = await base(stamped.input, stamped.init);
      if (response.status !== 401 && response.status !== 429) return response;
      lastStatus = response.status;
      cooled.set(key, Date.now() + retryAfterMs(response.headers.get("retry-after"), cooldownMs));
      const delay = Math.min(maxMs, baseMs * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error(`arkiv request failed (${lastStatus || "no-key"})`);
  };
}
