import { decodeFunctionResult, encodeFunctionData, parseAbi, toHex, type Address, type PublicClient } from "viem";
import { packetToBytes } from "viem/ens";
import { withSepolia } from "./live-market.ts";
import { publicDeployment } from "./public-deployment.ts";

const ZERO = "0x0000000000000000000000000000000000000000";

/** Map a universal-resolver addr read onto the solver name fields. */
export function mapSolverEns(args: {
  label: string;
  solver: Address;
  resolved: Address | null;
}): { ensName: string; matchesEns: boolean } {
  if (!args.label || !args.resolved) return { ensName: "", matchesEns: false };
  if (args.resolved.toLowerCase() === ZERO) return { ensName: "", matchesEns: false };
  if (args.resolved.toLowerCase() !== args.solver.toLowerCase()) return { ensName: "", matchesEns: false };
  return {
    ensName: `${args.label}.solvers.${publicDeployment.ens.parentLabel}.eth`,
    matchesEns: true,
  };
}

const findAbi = parseAbi([
  "function findResolver(bytes name) view returns (address resolver, bytes32 node, uint256 offset)",
]);
const resolveAbi = parseAbi(["function resolve(bytes name, bytes data) view returns (bytes, address)"]);
const addrAbi = parseAbi(["function addr(bytes32 node) view returns (address)"]);

async function readResolvedAddr(client: PublicClient, label: string): Promise<Address | null> {
  const name = `${label}.solvers.${publicDeployment.ens.parentLabel}.eth`;
  const dns = toHex(packetToBytes(name));
  const proxy = publicDeployment.ens.universalResolverProxy as Address;
  const found = await client.readContract({
    address: proxy,
    abi: findAbi,
    functionName: "findResolver",
    args: [dns],
  });
  const resolver = found[0];
  const node = found[1];
  if (resolver.toLowerCase() === ZERO) return null;
  const data = encodeFunctionData({ abi: addrAbi, functionName: "addr", args: [node] });
  const resolved = await client.readContract({
    address: proxy,
    abi: resolveAbi,
    functionName: "resolve",
    args: [dns, data],
  });
  if (resolved[0] === "0x") return null;
  return decodeFunctionResult({ abi: addrAbi, functionName: "addr", data: resolved[0] });
}

/** Addr read for `label.solvers.rival.eth` through the Sepolia universal resolver. */
export async function resolveSolverEns(
  args: { label: string; solver: Address },
  client?: PublicClient,
): Promise<{ ensName: string; matchesEns: boolean }> {
  if (!args.label) return { ensName: "", matchesEns: false };
  try {
    const resolved = client
      ? await readResolvedAddr(client, args.label)
      : await withSepolia((next) => readResolvedAddr(next, args.label));
    return mapSolverEns({ label: args.label, solver: args.solver, resolved });
  } catch {
    return { ensName: "", matchesEns: false };
  }
}
