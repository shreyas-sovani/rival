import { describe, expect, it } from "vitest";
import { presenceHeartbeat } from "./heartbeat.ts";

describe("presenceHeartbeat", () => {
  it("is due on the 60 second boundary and not one second earlier", () => {
    expect(presenceHeartbeat(1_000n, 1_059n)).toBe(false);
    expect(presenceHeartbeat(1_000n, 1_060n)).toBe(true);
    expect(presenceHeartbeat(1_000n, 1_061n)).toBe(true);
    expect(presenceHeartbeat(1_000n, 999n)).toBe(false);
  });
});
