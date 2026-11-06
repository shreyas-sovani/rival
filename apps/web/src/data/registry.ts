import { parseAbi, type Address } from "viem";
import type { SolverSourceRow } from "./leaderboard.ts";
import { latestFillTx } from "./auction.ts";
import { withSepolia } from "./live-market.ts";
import { publicDeployment } from "./public-deployment.ts";

const abi = parseAbi([
  "function labelOf(address solver) view returns (string)",
  "function isListed(address solver) view returns (bool)",
  "function house() view returns (address)",
  "function stats(address solver) view returns ((uint64 fills, uint64 makers, int128 sumImprovementBps, uint64 lastFill))",
]);

const registry = publicDeployment.registry as Address;

function strategyFor(address: string): string {
  const match = publicDeployment.solvers.find((solver) => solver.address.toLowerCase() === address.toLowerCase());
  return match?.strategy ?? "";
}

function avgBps(sum: bigint, fills: bigint): number {
  if (fills === 0n) return 0;
  return Number(sum / fills);
}

/** Registered solvers from SolverRegistry storage. ENS names stay blank. */
export async function readSolverRows(nowUnixMs = Date.now()): Promise<SolverSourceRow[]> {
  const house = await withSepolia((client) =>
    client.readContract({ address: registry, abi, functionName: "house" }),
  );
  const addresses = new Map<string, Address>();
  for (const solver of publicDeployment.solvers) {
    addresses.set(solver.address.toLowerCase(), solver.address as Address);
  }
  addresses.set(house.toLowerCase(), house);

  const rows: SolverSourceRow[] = [];
  for (const address of addresses.values()) {
    const [label, listed, stats] = await withSepolia((client) =>
      Promise.all([
        client.readContract({ address: registry, abi, functionName: "labelOf", args: [address] }),
        client.readContract({ address: registry, abi, functionName: "isListed", args: [address] }),
        client.readContract({ address: registry, abi, functionName: "stats", args: [address] }),
      ]),
    );
    if (label === "") continue;
    let lastFillTx: string | undefined;
    if (stats.fills > 0n) {
      try {
        lastFillTx = await latestFillTx(address);
      } catch {
        lastFillTx = undefined;
      }
    }
    const lastFill = stats.lastFill;
    rows.push({
      ensName: "",
      address,
      fills: stats.fills,
      makers: stats.makers,
      avgImprovementBps: avgBps(stats.sumImprovementBps, stats.fills),
      lastFillUnixMs: lastFill === 0n ? 0 : Number(lastFill) * 1000,
      nowUnixMs,
      expiresAtUnixMs: nowUnixMs,
      agent: false,
      role: address.toLowerCase() === house.toLowerCase() ? "house" : "solver",
      matchesEns: false,
      strategy: strategyFor(address),
      label,
      listed,
      ...(lastFillTx ? { lastFillTx } : {}),
      ...(lastFill === 0n ? { lastFillLabel: "none" } : {}),
      expiresLabel: "unavailable",
    });
  }
  rows.sort((a, b) => {
    if (a.fills !== b.fills) return a.fills > b.fills ? -1 : 1;
    return (a.label ?? "").localeCompare(b.label ?? "");
  });
  return rows;
}
