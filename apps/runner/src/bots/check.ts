/**
 * One local Sepolia cycle for M-022.
 *
 * The hosted soak (H-004, H-008) is not this task. This module does not
 * start maker or solver loops, and it does not mint or swap. A one-hour
 * soak is out of scope: the cycle is a single read of the hook timestamp.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, getAddress, http, parseAbi, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";

const DEPLOYMENTS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../deployments/sepolia.json",
);

const HOOK_ABI = parseAbi(["function oldestTimestamp(bytes32 id) view returns (uint32)"]);

interface PoolATarget {
  hook: Address;
  poolId: Hex;
}

function isBytes32(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function readPoolA(): PoolATarget | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(DEPLOYMENTS_PATH, "utf8"));
    if (!parsed || typeof parsed !== "object") return undefined;
    const record = parsed as {
      hook?: { address?: unknown };
      pools?: { A?: { poolId?: unknown } };
    };
    const hook = record.hook?.address;
    const poolId = record.pools?.A?.poolId;
    if (typeof hook !== "string" || !isBytes32(poolId)) return undefined;
    return { hook: getAddress(hook), poolId };
  } catch {
    return undefined;
  }
}

function sepoliaRpcUrl(): string | undefined {
  const value = process.env.SEPOLIA_RPC_URL;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Read hook `oldestTimestamp` for pool A. Exit 0 when the call returns a
 * timestamp. Exit 1 when the RPC is unset, the deployment record is unusable,
 * or the call reverts. Never throws for a missing RPC.
 */
export async function runCheck(): Promise<number> {
  const pool = readPoolA();
  const rpc = sepoliaRpcUrl();
  if (!pool || !rpc) return 1;

  try {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(rpc, { retryCount: 0, timeout: 10_000 }),
    });
    const timestamp = await client.readContract({
      address: pool.hook,
      abi: HOOK_ABI,
      functionName: "oldestTimestamp",
      args: [pool.poolId],
    });
    return typeof timestamp === "bigint" ? 0 : 1;
  } catch {
    return 1;
  }
}
