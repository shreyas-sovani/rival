import { describe, expect, it } from "vitest";
import { nonceManager } from "./nonce.ts";

describe("nonceManager", () => {
  it("keeps a separate counter per address", () => {
    const nonces = nonceManager();
    const atlas = "0x00000000000000000000000000000000000000a1" as const;
    const meridian = "0x00000000000000000000000000000000000000b2" as const;

    expect(nonces.next(atlas)).toBe(0n);
    expect(nonces.next(meridian)).toBe(0n);

    nonces.markUsed(atlas, 0n);
    expect(nonces.next(atlas)).toBe(1n);
    expect(nonces.next(meridian)).toBe(0n);

    nonces.markUsed(atlas, 4n);
    nonces.markUsed(meridian, 2n);
    expect(nonces.next(atlas)).toBe(5n);
    expect(nonces.next(meridian)).toBe(3n);

    nonces.markUsed(atlas, 1n);
    expect(nonces.next(atlas)).toBe(5n);
  });
});
