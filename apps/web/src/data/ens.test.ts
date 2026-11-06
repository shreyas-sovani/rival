import { encodeFunctionData, encodeFunctionResult, namehash, parseAbi, toHex, type PublicClient } from "viem";
import { packetToBytes } from "viem/ens";
import { describe, expect, it } from "vitest";
import { mapSolverEns, resolveSolverEns } from "./ens.ts";
import { publicDeployment } from "./public-deployment.ts";

const SOLVER = "0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3" as const;
const OTHER = "0x0000000000000000000000000000000000000001" as const;
const RESOLVER = "0x115eb53f0c60696633855f90b138178fb40b2b2c" as const;
const ADDR_ABI = parseAbi(["function addr(bytes32 node) view returns (address)"]);
const NAME = "atlas.solvers.rival.eth";

describe("solver ENS mapping", () => {
  it("uses the full name when the resolved address matches the solver", () => {
    expect(mapSolverEns({ label: "atlas", solver: SOLVER, resolved: SOLVER })).toEqual({
      ensName: NAME,
      matchesEns: true,
    });
  });

  it("stays blank when resolution fails or the address does not match", () => {
    expect(mapSolverEns({ label: "atlas", solver: SOLVER, resolved: null })).toEqual({
      ensName: "",
      matchesEns: false,
    });
    expect(mapSolverEns({ label: "atlas", solver: SOLVER, resolved: OTHER })).toEqual({
      ensName: "",
      matchesEns: false,
    });
    expect(
      mapSolverEns({
        label: "atlas",
        solver: SOLVER,
        resolved: "0x0000000000000000000000000000000000000000",
      }),
    ).toEqual({ ensName: "", matchesEns: false });
  });
});

describe("Sepolia universal resolver", () => {
  it("reads the addr record on the universal resolver proxy when the address matches", async () => {
    const node = namehash(NAME);
    const calls: { address: string; functionName: string; args: readonly unknown[] }[] = [];
    const client = {
      async readContract(params: { address: string; functionName: string; args: readonly unknown[] }) {
        calls.push(params);
        if (params.functionName === "findResolver") return [RESOLVER, node, 0n] as const;
        if (params.functionName === "resolve") {
          return [encodeFunctionResult({ abi: ADDR_ABI, functionName: "addr", result: SOLVER }), RESOLVER] as const;
        }
        throw new Error(params.functionName);
      },
    } as unknown as PublicClient;

    await expect(resolveSolverEns({ label: "atlas", solver: SOLVER }, client)).resolves.toEqual({
      ensName: NAME,
      matchesEns: true,
    });

    const proxy = publicDeployment.ens.universalResolverProxy.toLowerCase();
    expect(calls[0]?.address.toLowerCase()).toBe(proxy);
    expect(calls[0]?.functionName).toBe("findResolver");
    expect(calls[0]?.args[0]).toBe(toHex(packetToBytes(NAME)));
    expect(calls[1]?.address.toLowerCase()).toBe(proxy);
    expect(calls[1]?.functionName).toBe("resolve");
    expect(calls[1]?.args[1]).toBe(encodeFunctionData({ abi: ADDR_ABI, functionName: "addr", args: [node] }));
  });

  it("stays blank when the universal resolver reverts", async () => {
    const client = {
      async readContract() {
        throw new Error("execution reverted");
      },
    } as unknown as PublicClient;
    await expect(resolveSolverEns({ label: "atlas", solver: SOLVER }, client)).resolves.toEqual({
      ensName: "",
      matchesEns: false,
    });
  });

  it("stays blank when the resolved address does not match the solver", async () => {
    const client = {
      async readContract(params: { functionName: string }) {
        if (params.functionName === "findResolver") {
          return [RESOLVER, namehash(NAME), 0n] as const;
        }
        return [encodeFunctionResult({ abi: ADDR_ABI, functionName: "addr", result: OTHER }), RESOLVER] as const;
      },
    } as unknown as PublicClient;
    await expect(resolveSolverEns({ label: "atlas", solver: SOLVER }, client)).resolves.toEqual({
      ensName: "",
      matchesEns: false,
    });
  });

  it("stays blank when findResolver returns no resolver", async () => {
    const calls: string[] = [];
    const client = {
      async readContract(params: { functionName: string }) {
        calls.push(params.functionName);
        return ["0x0000000000000000000000000000000000000000", `0x${"00".repeat(32)}`, 0n] as const;
      },
    } as unknown as PublicClient;
    await expect(resolveSolverEns({ label: "atlas", solver: SOLVER }, client)).resolves.toEqual({
      ensName: "",
      matchesEns: false,
    });
    expect(calls).toEqual(["findResolver"]);
  });
});
