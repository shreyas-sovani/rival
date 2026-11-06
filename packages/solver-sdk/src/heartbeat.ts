/** Presence entities are extended on this cadence (FR-ARK-03). */
export const PRESENCE_INTERVAL_SEC = 60n;

/** True when at least 60 seconds have elapsed since the last extend. */
export function presenceHeartbeat(lastExtend: bigint, now: bigint): boolean {
  return now - lastExtend >= PRESENCE_INTERVAL_SEC;
}
