import { describe, expect, it } from "vitest";
import { testIds } from "../testids.ts";

describe("testIds", () => {
  it("exports unique non-empty ids", () => {
    const values = Object.values(testIds);
    expect(values.length).toBeGreaterThan(0);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(value).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
