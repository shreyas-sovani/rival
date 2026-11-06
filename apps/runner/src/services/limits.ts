import { ApiError } from "../handlers/types.ts";

/** Sliding window of accepted intents for one maker, measured by the injected clock. */
export class MakerRateLimit {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowSec: number,
    private readonly now: () => number,
  ) {}

  take(maker: string): void {
    const key = maker.toLowerCase();
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > t - this.windowSec);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      throw new ApiError("RATE_LIMITED", "too many intents for this maker");
    }
    recent.push(t);
    this.hits.set(key, recent);
  }
}

/** One token claim per wallet per UTC day, and at most `maxTokensPerIp` token claims per IP per day. */
export class FaucetClaims {
  private readonly wallets = new Set<string>();
  private readonly ipTokens = new Map<string, number>();

  constructor(private readonly maxTokensPerIp: number) {}

  take(wallet: string, day: number, kind: "tokens" | "eth", ip: string): void {
    const walletKey = `${wallet.toLowerCase()}:${day}:${kind}`;
    if (this.wallets.has(walletKey)) {
      throw new ApiError("RATE_LIMITED", "faucet claim already used for this wallet and day");
    }
    if (kind === "tokens") {
      const ipKey = `${ip}:${day}`;
      const count = this.ipTokens.get(ipKey) ?? 0;
      if (count >= this.maxTokensPerIp) {
        throw new ApiError("RATE_LIMITED", "faucet IP cap reached for this day");
      }
      this.ipTokens.set(ipKey, count + 1);
    }
    this.wallets.add(walletKey);
  }
}
