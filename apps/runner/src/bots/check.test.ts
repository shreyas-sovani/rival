import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { NotImplemented } from "../handlers/types.ts";
import { runCheck as runServicesCheck, startServices } from "../services/index.ts";
import { runCheck } from "./check.ts";

const FAKE_RPC = "http://127.0.0.1:9/sepolia";

const mocks = vi.hoisted(() => ({
  http: vi.fn(),
  createPublicClient: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    http: mocks.http,
    createPublicClient: mocks.createPublicClient,
  };
});

const deployment = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../../deployments/sepolia.json"), "utf8"),
) as { hook: { address: string }; pools: { A: { poolId: string } } };

beforeEach(() => {
  mocks.readContract.mockReset();
  mocks.http.mockReset();
  mocks.http.mockImplementation((url: string) => ({ url }));
  mocks.createPublicClient.mockReset();
  mocks.createPublicClient.mockImplementation(() => ({ readContract: mocks.readContract }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("runCheck", () => {
  it("returns 1 and does not call the hook when SEPOLIA_RPC_URL is unset", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", "");
    await expect(runCheck()).resolves.toBe(1);
    expect(mocks.http).not.toHaveBeenCalled();
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(mocks.readContract).not.toHaveBeenCalled();
  });

  it("returns 1 and does not call the hook when SEPOLIA_RPC_URL is blank", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", "   ");
    await expect(runCheck()).resolves.toBe(1);
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
  });

  it("returns 1 when oldestTimestamp reverts", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", FAKE_RPC);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.readContract.mockRejectedValue(new Error(`execution reverted at ${FAKE_RPC}`));

    await expect(runCheck()).resolves.toBe(1);

    expect(mocks.readContract).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("returns 0 when oldestTimestamp returns a timestamp", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", FAKE_RPC);
    mocks.readContract.mockResolvedValue(1_700_000_000n);

    await expect(runCheck()).resolves.toBe(0);

    expect(mocks.http).toHaveBeenCalledTimes(1);
    expect(mocks.http).toHaveBeenCalledWith(FAKE_RPC, { retryCount: 0, timeout: 10_000 });
    expect(mocks.createPublicClient).toHaveBeenCalledTimes(1);
    expect(mocks.readContract).toHaveBeenCalledTimes(1);
    expect(mocks.readContract).toHaveBeenCalledWith({
      address: getAddress(deployment.hook.address),
      abi: expect.any(Array),
      functionName: "oldestTimestamp",
      args: [deployment.pools.A.poolId],
    });
  });

  it("returns 0 when the timestamp is zero", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", FAKE_RPC);
    mocks.readContract.mockResolvedValue(0n);
    await expect(runCheck()).resolves.toBe(0);
  });
});

describe("services runCheck", () => {
  it("stays NotImplemented unless RUNNER_SERVICES is on", async () => {
    vi.stubEnv("RUNNER_SERVICES", "off");
    vi.stubEnv("SEPOLIA_RPC_URL", FAKE_RPC);
    await expect(startServices()).rejects.toBeInstanceOf(NotImplemented);
    await expect(runServicesCheck()).rejects.toMatchObject({ message: "NOT_IMPLEMENTED(M-022)" });
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
  });

  it("runs one local cycle when RUNNER_SERVICES is on and does not boot bots", async () => {
    vi.stubEnv("RUNNER_SERVICES", "on");
    vi.stubEnv("SEPOLIA_RPC_URL", FAKE_RPC);
    mocks.readContract.mockResolvedValue(1_700_000_000n);

    await expect(runServicesCheck()).resolves.toBe(0);
    await expect(startServices()).rejects.toBeInstanceOf(NotImplemented);
    expect(mocks.readContract).toHaveBeenCalledTimes(1);
  });
});
