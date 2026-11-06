import { describe, expect, it } from "vitest";
import { bpsToPercentString, formatDuration, formatUnitsFixed, relativeTime, shortHex } from "./format.ts";

describe("formatUnitsFixed", () => {
  it("truncates fractional digits toward zero", () => {
    expect(formatUnitsFixed(1_999n, 3, 2)).toBe("1.99");
    expect(formatUnitsFixed(-1_999n, 3, 2)).toBe("-1.99");
    expect(formatUnitsFixed(1_000n, 3, 2)).toBe("1");
    expect(formatUnitsFixed(1n, 18, 6)).toBe("0");
    expect(formatUnitsFixed(1_500_000_000_000_000_000n, 18, 2)).toBe("1.5");
    expect(formatUnitsFixed(0n, 18, 4)).toBe("0");
  });
});

describe("shortHex", () => {
  it("keeps the head and tail", () => {
    expect(shortHex("0x1234567890abcdef")).toBe("0x1234…cdef");
    expect(shortHex("0xabc")).toBe("0xabc");
  });
});

describe("formatDuration", () => {
  it("truncates toward zero into hours, minutes, and seconds", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3661)).toBe("1h 1m");
    expect(formatDuration(-5)).toBe("-5s");
    expect(formatDuration(9.9)).toBe("9s");
  });
});

describe("relativeTime", () => {
  it("formats a millisecond delta", () => {
    expect(relativeTime(0, 0)).toBe("just now");
    expect(relativeTime(125_000, 0)).toBe("in 2m 5s");
    expect(relativeTime(0, 125_000)).toBe("2m 5s ago");
  });
});

describe("bpsToPercentString", () => {
  it("shows two percent digits and truncates toward zero", () => {
    expect(bpsToPercentString(150)).toBe("1.50%");
    expect(bpsToPercentString(-150)).toBe("-1.50%");
    expect(bpsToPercentString(0)).toBe("0.00%");
    expect(bpsToPercentString(1)).toBe("0.01%");
    expect(bpsToPercentString(199.9)).toBe("1.99%");
  });
});
