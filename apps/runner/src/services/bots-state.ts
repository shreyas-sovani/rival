import type { BotHealth } from "../handlers/types.ts";

const bots: Record<string, BotHealth> = {};

export function noteBot(label: string, ok: boolean, now = Math.floor(Date.now() / 1000)): void {
  const prev = bots[label];
  bots[label] = { ok, lastSeenAt: ok ? now : (prev?.lastSeenAt ?? null) };
}

/** Empty until a loop reports. The house row keeps `/api/health` on the degraded snapshot. */
export function botSnapshot(): Record<string, BotHealth> {
  if (Object.keys(bots).length === 0) return { house: { ok: false, lastSeenAt: null } };
  return { ...bots };
}
