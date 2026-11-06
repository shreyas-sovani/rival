import { afterEach, describe, expect, it, vi } from "vitest";
import { browserStorage } from "./storage.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser storage", () => {
  it("reads and writes localStorage", async () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
    });
    const storage = browserStorage();
    await storage.set("rival.test", "kept");
    expect(await storage.get("rival.test")).toBe("kept");
    expect(map.get("rival.test")).toBe("kept");
  });

  it("falls back to memory when localStorage is missing", async () => {
    vi.stubGlobal("localStorage", undefined);
    const storage = browserStorage();
    await storage.set("rival.memory", "kept");
    expect(await browserStorage().get("rival.memory")).toBe("kept");
  });
});
