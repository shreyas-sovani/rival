import { getQuoteAtTick } from "@rival/intent";
import { createPublicClient, http, parseAbi, type Address, type PublicClient } from "viem";
import { publicDeployment } from "./public-deployment.ts";

/** Browser-safe Sepolia endpoints. No API keys. */
export const PUBLIC_SEPOLIA_RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
] as const;

const STATE_VIEW = "0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C" as Address;
const UINT128_MAX = (1n << 128n) - 1n;

const abi = parseAbi([
  "function consult((address,address,uint24,int24,address) key, uint32 window) view returns (int24)",
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function isListed(address solver) view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

const tWeth = publicDeployment.tokens.tWETH as Address;
const tUsdc = publicDeployment.tokens.tUSDC as Address;
const hook = publicDeployment.hook.address as Address;
const registry = publicDeployment.registry as Address;
const poolId = publicDeployment.pools.A.poolId as `0x${string}`;

const poolKey = [tWeth, tUsdc, publicDeployment.pools.A.fee, publicDeployment.pools.A.tickSpacing, hook] as const;

export interface ListedSolver {
  label: string;
  address: Address;
}

export interface LiveMarket {
  spotTick: number;
  twapTick: number;
  listed: ListedSolver[];
}

export interface TokenBalances {
  sell: bigint;
  buy: bigint;
}

/** tWETH is currency0, so selling it is zeroForOne. */
export function quoteSell(tick: number, amountIn: bigint): bigint {
  if (amountIn <= 0n || amountIn > UINT128_MAX) {
    throw new Error("amountIn out of range");
  }
  return getQuoteAtTick(tick, amountIn, true);
}

async function withRpc<T>(read: (client: PublicClient) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const url of PUBLIC_SEPOLIA_RPCS) {
    try {
      const client = createPublicClient({ transport: http(url, { timeout: 8_000 }) });
      return await read(client);
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("Sepolia RPC failed");
}

/** Spot tick, 60-second hook TWAP, and which recorded solvers are still listed. */
export async function readLiveMarket(): Promise<LiveMarket> {
  return withRpc(async (client) => {
    const [slot0, twapTick] = await Promise.all([
      client.readContract({
        address: STATE_VIEW,
        abi,
        functionName: "getSlot0",
        args: [poolId],
      }),
      client.readContract({
        address: hook,
        abi,
        functionName: "consult",
        args: [poolKey, 60],
      }),
    ]);
    const listed: ListedSolver[] = [];
    for (const solver of publicDeployment.solvers) {
      const ok = await client.readContract({
        address: registry,
        abi,
        functionName: "isListed",
        args: [solver.address as Address],
      });
      if (ok) listed.push({ label: solver.label, address: solver.address as Address });
    }
    return { spotTick: Number(slot0[1]), twapTick: Number(twapTick), listed };
  });
}

export async function readBalances(owner: Address): Promise<TokenBalances> {
  return withRpc(async (client) => {
    const [sell, buy] = await Promise.all([
      client.readContract({
        address: tWeth,
        abi,
        functionName: "balanceOf",
        args: [owner],
      }),
      client.readContract({
        address: tUsdc,
        abi,
        functionName: "balanceOf",
        args: [owner],
      }),
    ]);
    return { sell, buy };
  });
}

/** Already-connected browser account. Does not prompt. */
export async function browserAccount(): Promise<Address | null> {
  const provider = (globalThis as { ethereum?: { request?: (args: { method: string }) => Promise<unknown> } }).ethereum;
  if (!provider?.request) return null;
  const accounts = await provider.request({ method: "eth_accounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") return null;
  return accounts[0] as Address;
}
