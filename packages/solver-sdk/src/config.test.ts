import { generatePrivateKey } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { isSolverConfig, runSolver } from "./config.ts";
import type { RunSolverPorts } from "./run.ts";

const SETTLEMENT = "0xdD66D017e4B4FfF51aBEf2f559C68065D4FD9850" as const;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

function ports(listOpen: RunSolverPorts["book"]["listOpen"]): RunSolverPorts {
  return {
    book: { listOpen },
    quoter: { quoteExactInput: async () => 0n },
    submitter: {
      balanceOf: async () => 0n,
      nonceUsed: async () => false,
      submit: async () => undefined,
    },
    clock: { now: () => 0n },
    presence: { lastExtend: async () => 0n, extend: async () => undefined },
    strategy: "sprint",
    chainId: 11155111,
    settlement: SETTLEMENT,
    permit2: PERMIT2,
  };
}

describe("runSolver config", () => {
  it("recognizes a solver config and ignores a port bag", () => {
    const key = generatePrivateKey();
    expect(isSolverConfig({ label: "atlas", key, rpc: "http://127.0.0.1:1", strategy: "patient" })).toBe(true);
    expect(isSolverConfig(ports(async () => []))).toBe(false);
  });

  it("runs the injected loop and resolves when the signal aborts", async () => {
    const listOpen = vi.fn(async () => []);
    const controller = new AbortController();
    const pending = runSolver(
      { label: "atlas", key: generatePrivateKey(), rpc: "http://127.0.0.1:1", strategy: "patient" },
      { ports: ports(listOpen), signal: controller.signal, intervalMs: 20 },
    );
    await vi.waitFor(() => expect(listOpen).toHaveBeenCalled());
    controller.abort();
    await pending;
    const calls = listOpen.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(listOpen.mock.calls.length).toBe(calls);
  });

  it("resolves immediately when the signal is already aborted", async () => {
    const listOpen = vi.fn(async () => []);
    await runSolver(
      { label: "atlas", key: generatePrivateKey(), rpc: "http://127.0.0.1:1" },
      { ports: ports(listOpen), signal: AbortSignal.abort() },
    );
    expect(listOpen).not.toHaveBeenCalled();
  });
});
