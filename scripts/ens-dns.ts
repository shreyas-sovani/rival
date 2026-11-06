/** DNS wire encoding used by PermissionedResolver `authorizeTextRoles`. */
export function dnsEncode(name: string): string {
  if (name.length === 0) return "0x00";
  const labels = name.split(".");
  const bytes: number[] = [];
  for (const label of labels) {
    const raw = Buffer.from(label, "utf8");
    if (raw.length === 0 || raw.length > 255) {
      throw new Error(`DNS label length out of range: ${raw.length}`);
    }
    bytes.push(raw.length, ...raw);
  }
  bytes.push(0);
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

/** First available candidate, in the given order. */
export function chooseLabel(candidates: readonly string[], available: readonly boolean[]): string | null {
  if (candidates.length !== available.length) {
    throw new Error("availability length does not match candidates");
  }
  for (let i = 0; i < candidates.length; i += 1) {
    if (available[i]) return candidates[i] ?? null;
  }
  return null;
}
