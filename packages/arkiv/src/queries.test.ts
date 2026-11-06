import { describe, expect, it } from "vitest";
import { buildIntentQuery, buildPresenceQuery } from "./queries.ts";

const OPEN =
  "arkiv.schema = str('rival.intent.v1') AND status = str('open') AND pair = str('tWETH/tUSDC') AND deadline > u64(1762401600) ORDER BY deadline:u64 ASC";

const BETWEEN =
  "arkiv.schema = str('rival.intent.v1') AND status = str('open') AND amountIn BETWEEN u256(1000000000000000000) AND u256(10000000000000000000)";

const MAKER =
  "arkiv.schema = str('rival.intent.v1') AND maker = addr(0x0000000000000000000000000000000000000001)";

const GATE = "arkiv.schema = str('rival.intent.v1') AND gate = i32(2) AND status = str('open')";

const PRESENCE = "arkiv.schema = str('rival.solver.v1') AND pair = str('tWETH/tUSDC')";

describe("query strings", () => {
  it("matches the open-intent example", () => {
    const query = buildIntentQuery({
      now: 1_762_401_600,
      status: "open",
      pair: "tWETH/tUSDC",
      sortDeadlineAsc: true,
    });
    expect(query).toBe(OPEN);
    expect(query.includes("<now>")).toBe(false);
  });

  it("matches the amount BETWEEN example", () => {
    expect(
      buildIntentQuery({
        status: "open",
        amountInMin: 1_000_000_000_000_000_000n,
        amountInMax: 10_000_000_000_000_000_000n,
      }),
    ).toBe(BETWEEN);
  });

  it("matches the maker example", () => {
    expect(buildIntentQuery({ maker: "0x0000000000000000000000000000000000000001" })).toBe(MAKER);
  });

  it("matches the named-gate example", () => {
    expect(buildIntentQuery({ gate: 2, status: "open" })).toBe(GATE);
  });

  it("matches the presence filter", () => {
    expect(buildPresenceQuery("tWETH/tUSDC")).toBe(PRESENCE);
  });

  it("uses deadlineAfter instead of now when both are set", () => {
    const query = buildIntentQuery({
      now: 1,
      deadlineAfter: 1_762_401_600,
      status: "open",
      pair: "tWETH/tUSDC",
      sortDeadlineAsc: true,
    });
    expect(query).toBe(OPEN);
  });
});
