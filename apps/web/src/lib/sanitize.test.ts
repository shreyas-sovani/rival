import { describe, expect, it } from "vitest";
import { sanitizeDisplayText } from "./sanitize.ts";

describe("sanitizeDisplayText", () => {
  it("strips an RTL override", () => {
    expect(sanitizeDisplayText("safe\u202Eevil", 80)).toBe("safeevil");
  });

  it("strips zero-width characters", () => {
    expect(sanitizeDisplayText("a\u200Bb\u200Cc\u200Dd\uFEFF", 80)).toBe("abcd");
  });

  it("strips C0 and C1 controls and bidi isolates", () => {
    expect(sanitizeDisplayText("a\u0000b\u0007c\u0085d\u2066e\u2069", 80)).toBe("abcde");
  });

  it("normalizes to NFC", () => {
    expect(sanitizeDisplayText("e\u0301", 80)).toBe("\u00e9");
  });

  it("truncates a 10 KB string with an ellipsis and returns plain text", () => {
    const hostile = `${"\u202E<script>alert(1)</script>\u200B".repeat(200)}${"x".repeat(10_000)}`;
    expect(hostile.length).toBeGreaterThan(10_000);
    const out = sanitizeDisplayText(hostile, 32);
    expect(out).toHaveLength(32);
    expect(out.endsWith("…")).toBe(true);
    expect(out.includes("<")).toBe(false);
    expect(out.includes(">")).toBe(false);
    expect(out.includes("\u202E")).toBe(false);
    expect(out.includes("\u200B")).toBe(false);
  });

  it("never returns HTML", () => {
    const out = sanitizeDisplayText("<img src=x onerror=alert(1)>", 80);
    expect(out).toBe("img src=x onerror=alert(1)");
    expect(out.includes("<")).toBe(false);
    expect(out.includes(">")).toBe(false);
  });
});
