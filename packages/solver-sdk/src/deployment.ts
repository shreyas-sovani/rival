import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getAddress, type Address, type Hex } from "viem";
import type { PoolRef } from "./live.ts";

/** Canonical Permit2. It is not a Rival deployment, so it is not in sepolia.json. */
export const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");

export const CHAIN_ID = 11155111;

interface PoolFile {
  poolId: string;
  fee: number;
  tickSpacing: number;
  currency0: string;
  currency1: string;
}

interface DeploymentFile {
  chainId: number;
  tokens: { tWETH: string; tUSDC: string };
  hook: { address: string };
  pools: { A: PoolFile; B: PoolFile };
  settlement: string;
  registry: string;
  names: string;
  uniswapSolvers: string[];
  runnerUrl: string;
}

export interface RivalDeployment {
  chainId: number;
  registry: Address;
  settlement: Address;
  names: Address;
  hook: Address;
  uniswapSolver: Address;
  runnerUrl: string;
  tokens: { tWETH: Address; tUSDC: Address };
  poolA: PoolRef;
  poolB: PoolRef;
  /** Pool A fee in hundredths of a bip. Settlement records this on `Filled`. */
  poolFee: number;
}

let cached: RivalDeployment | undefined;

function poolOf(raw: PoolFile, hooks: Address): PoolRef {
  return {
    poolId: raw.poolId as Hex,
    currency0: getAddress(raw.currency0),
    currency1: getAddress(raw.currency1),
    fee: raw.fee,
    tickSpacing: raw.tickSpacing,
    hooks,
  };
}

/** Addresses from `deployments/sepolia.json`. */
export function rivalDeployment(): RivalDeployment {
  if (cached) return cached;
  const file = fileURLToPath(new URL("../../../deployments/sepolia.json", import.meta.url));
  const parsed = JSON.parse(readFileSync(file, "utf8")) as DeploymentFile;
  if (parsed.chainId !== CHAIN_ID) throw new Error("deployment chain is not Sepolia");
  const solver = parsed.uniswapSolvers[0];
  if (!solver) throw new Error("deployment is missing the Uniswap solver");
  const hook = getAddress(parsed.hook.address);
  const zero = getAddress("0x0000000000000000000000000000000000000000");
  cached = {
    chainId: parsed.chainId,
    registry: getAddress(parsed.registry),
    settlement: getAddress(parsed.settlement),
    names: getAddress(parsed.names),
    hook,
    uniswapSolver: getAddress(solver),
    runnerUrl: parsed.runnerUrl.replace(/\/$/, ""),
    tokens: {
      tWETH: getAddress(parsed.tokens.tWETH),
      tUSDC: getAddress(parsed.tokens.tUSDC),
    },
    poolA: poolOf(parsed.pools.A, hook),
    poolB: poolOf(parsed.pools.B, zero),
    poolFee: parsed.pools.A.fee,
  };
  return cached;
}
