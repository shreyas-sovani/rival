import { describe, expect, it } from "vitest";
import { withRetry } from "./retry.ts";

describe("withRetry", () => {
  it("retries retryable failures then returns", async () => {
    let calls = 0;
    const value = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("temporary");
        return "ok";
      },
      { retries: 2, baseMs: 1, maxMs: 4, jitter: false, isRetryable: () => true },
    );
    expect(value).toBe("ok");
    expect(calls).toBe(3);
  });

  it("stops on a non-retryable error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error("permanent");
        },
        { retries: 4, baseMs: 1, maxMs: 4, jitter: false, isRetryable: () => false },
      ),
    ).rejects.toThrow("permanent");
    expect(calls).toBe(1);
  });

  it("accepts jitter", async () => {
    const value = await withRetry(async () => "ok", {
      retries: 1,
      baseMs: 1,
      maxMs: 2,
      jitter: true,
      isRetryable: () => true,
    });
    expect(value).toBe("ok");
  });
});
