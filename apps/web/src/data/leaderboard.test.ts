import { describe, expect, it } from "vitest";
import { toLeaderboardVM } from "./leaderboard.ts";

describe("leaderboard adapter", () => {
  it("maps one injected solver row into LeaderboardVM", () => {
    const vm = toLeaderboardVM({
      rows: [
        {
          ensName: "atlas.rival.eth",
          address: "0x00000000000000000000000000000000000000aa",
          fills: 4n,
          makers: 2n,
          avgImprovementBps: 150,
          lastFillUnixMs: 0,
          nowUnixMs: 0,
          expiresAtUnixMs: 125_000,
          agent: true,
          role: "solver",
          matchesEns: true,
          strategy: "sprint",
        },
      ],
    });

    expect(vm.empty).toBe(false);
    expect(vm.rows).toHaveLength(1);
    const row = vm.rows[0];
    if (!row) throw new Error("expected a solver row");
    expect(row).toMatchObject({
      label: "atlas.rival.eth",
      ensName: "atlas.rival.eth",
      address: "0x00000000000000000000000000000000000000aa",
      fills: "4",
      makers: "2",
      avgImprovement: "1.50%",
      lastFill: "just now",
      expiresIn: "2m 5s",
      agent: true,
      role: "solver",
      matchesEns: true,
      strategy: "sprint",
    });
    expect(row.ensLink).toMatchObject({
      chain: "sepolia",
      kind: "address",
      value: "0x00000000000000000000000000000000000000aa",
      label: "atlas.rival.eth",
    });
  });
});
