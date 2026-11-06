import { readFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { initSolver } from "./init.ts";

const deployment = JSON.parse(readFileSync(new URL("../../../deployments/sepolia.json", import.meta.url), "utf8")) as {
  registry: string;
};

const DEPOSIT_TOKEN = "0x571c992873D31310B11Bf6bF6B44f2748B4bce8C";

function clients(readContract: ReturnType<typeof vi.fn>, writeContract = vi.fn()) {
  const key = generatePrivateKey();
  return {
    key,
    account: privateKeyToAccount(key),
    readContract,
    writeContract,
    waitForTransactionReceipt: vi.fn(async () => ({ status: "success" as const })),
  };
}

describe("initSolver", () => {
  it("returns the listed label without sending register when labelOf is already set", async () => {
    const readContract = vi.fn(async (args: { functionName: string }) => {
      if (args.functionName === "labelOf") return "atlas";
      throw new Error(args.functionName);
    });
    const rig = clients(readContract);

    const result = await initSolver(
      { label: "other", key: rig.key, rpc: "http://127.0.0.1:1" },
      {
        clients: {
          publicClient: { readContract: rig.readContract, waitForTransactionReceipt: rig.waitForTransactionReceipt },
          walletClient: { writeContract: rig.writeContract },
          account: rig.account,
        },
      },
    );

    expect(result).toEqual({ address: rig.account.address, label: "atlas", listed: true });
    expect(rig.writeContract).not.toHaveBeenCalled();
    expect(rig.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it("approves the deposit token read from the registry, then register(label)", async () => {
    const depositAmount = 123_456n;
    const readContract = vi.fn(async (args: { functionName: string }): Promise<unknown> => {
      if (args.functionName === "labelOf") return "";
      if (args.functionName === "depositToken") return DEPOSIT_TOKEN;
      if (args.functionName === "depositAmount") return depositAmount;
      if (args.functionName === "allowance") return 0n;
      throw new Error(args.functionName);
    });
    const rig = clients(readContract);
    rig.writeContract.mockResolvedValueOnce("0x11").mockResolvedValueOnce("0x22");
    let labels = 0;
    readContract.mockImplementation(async (args: { functionName: string }) => {
      if (args.functionName === "labelOf") {
        labels += 1;
        return labels === 1 ? "" : "nova";
      }
      if (args.functionName === "depositToken") return DEPOSIT_TOKEN;
      if (args.functionName === "depositAmount") return depositAmount;
      if (args.functionName === "allowance") return 0n;
      throw new Error(args.functionName);
    });

    const result = await initSolver(
      { label: "nova", key: rig.key, rpc: "http://127.0.0.1:1" },
      {
        clients: {
          publicClient: { readContract: rig.readContract, waitForTransactionReceipt: rig.waitForTransactionReceipt },
          walletClient: { writeContract: rig.writeContract },
          account: rig.account,
        },
      },
    );

    expect(result).toEqual({ address: rig.account.address, label: "nova", listed: true });
    expect(rig.writeContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        functionName: "approve",
        address: DEPOSIT_TOKEN,
        args: [expect.stringMatching(new RegExp(deployment.registry, "i")), depositAmount],
      }),
    );
    expect(rig.writeContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        functionName: "register",
        address: expect.stringMatching(new RegExp(deployment.registry, "i")),
        args: ["nova"],
      }),
    );
    expect(rig.waitForTransactionReceipt).toHaveBeenCalledTimes(2);
  });

  it("skips approve when the registry allowance already covers the deposit", async () => {
    const depositAmount = 100n;
    const readContract = vi.fn(async (args: { functionName: string }): Promise<unknown> => {
      if (args.functionName === "labelOf") return "";
      if (args.functionName === "depositToken") return DEPOSIT_TOKEN;
      if (args.functionName === "depositAmount") return depositAmount;
      if (args.functionName === "allowance") return depositAmount;
      throw new Error(args.functionName);
    });
    const rig = clients(readContract);
    rig.writeContract.mockResolvedValue("0x33");
    let labels = 0;
    readContract.mockImplementation(async (args: { functionName: string }) => {
      if (args.functionName === "labelOf") {
        labels += 1;
        return labels === 1 ? "" : "nova";
      }
      if (args.functionName === "depositToken") return DEPOSIT_TOKEN;
      if (args.functionName === "depositAmount") return depositAmount;
      if (args.functionName === "allowance") return depositAmount;
      throw new Error(args.functionName);
    });

    await initSolver(
      { label: "nova", key: rig.key, rpc: "http://127.0.0.1:1" },
      {
        clients: {
          publicClient: { readContract: rig.readContract, waitForTransactionReceipt: rig.waitForTransactionReceipt },
          walletClient: { writeContract: rig.writeContract },
          account: rig.account,
        },
      },
    );

    expect(rig.writeContract).toHaveBeenCalledTimes(1);
    expect(rig.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "register" }));
  });
});
