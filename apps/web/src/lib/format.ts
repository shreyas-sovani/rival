/**
 * Display only. Fractional digits are cut at `maxFrac` toward zero.
 * No rounding, pricing, or settlement.
 */

export function formatUnitsFixed(value: bigint, decimals: number, maxFrac: number): string {
  if (decimals < 0 || maxFrac < 0) throw new Error("decimals and maxFrac must be >= 0");
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  let digits = (abs % scale).toString().padStart(decimals, "0");
  if (maxFrac < digits.length) digits = digits.slice(0, maxFrac);
  digits = digits.replace(/0+$/, "");
  const body = digits.length > 0 ? `${whole.toString()}.${digits}` : whole.toString();
  return negative && abs !== 0n ? `-${body}` : body;
}

export function shortHex(hex: string, head = 6, tail = 4): string {
  if (head < 0 || tail < 0) throw new Error("head and tail must be >= 0");
  if (hex.length <= head + tail) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export function formatDuration(secs: number): string {
  const negative = secs < 0;
  const whole = Math.trunc(Math.abs(secs));
  const hours = Math.trunc(whole / 3600);
  const minutes = Math.trunc((whole % 3600) / 60);
  const seconds = whole % 60;
  const body = hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return negative && whole !== 0 ? `-${body}` : body;
}

/** `ts` and `now` are unix milliseconds. */
export function relativeTime(ts: number, now: number): string {
  const deltaSec = Math.trunc((ts - now) / 1000);
  if (deltaSec === 0) return "just now";
  const body = formatDuration(Math.abs(deltaSec));
  return deltaSec > 0 ? `in ${body}` : `${body} ago`;
}

/** Integer basis points. Truncates toward zero. 150 → "1.50%". */
export function bpsToPercentString(bps: number): string {
  const negative = bps < 0;
  const abs = Math.trunc(Math.abs(bps));
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const body = `${whole}.${String(frac).padStart(2, "0")}%`;
  return negative && abs !== 0 ? `-${body}` : body;
}
