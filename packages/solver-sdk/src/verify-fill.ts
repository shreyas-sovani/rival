import { receiptMath } from "../../intent/src/math.ts";
import { createPublicClient, decodeEventLog, parseAbiItem, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { rivalDeployment } from "./deployment.ts";
import { createRpcPool } from "./rpc-pool.ts";

const filled = parseAbiItem(
  "event Filled(bytes32 indexed intentHash, address indexed maker, address indexed solver, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fairOut, uint256 fairOutAfterFee, int32 improvementBps, int32 curveBps, uint32 elapsed)",
);

const poolFeeAbi = [
  {
    type: "function",
    name: "poolFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint24" }],
  },
] as const;

export interface VerifyFillClient {
  getTransactionReceipt: (args: { hash: Hex }) => Promise<{
    logs: readonly { address: string; data: Hex; topics: readonly unknown[] }[];
  }>;
  readContract: (args: { address: Address; abi: unknown; functionName: string }) => Promise<unknown>;
}

export interface VerifyFillResult {
  txHash: Hex;
  intentHash: Hex;
  maker: Address;
  solver: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOut: string;
  fairOut: string;
  fairOutAfterFee: string;
  improvementBps: number;
  curveBps: number;
  elapsed: number;
  matchesReceipt: boolean;
}

function clientFromEnv(): VerifyFillClient {
  const rpc = process.env.SEPOLIA_RPC_URL?.trim() ?? "";
  if (!rpc) throw new Error("missing rpc: set SEPOLIA_RPC_URL");
  return createPublicClient({
    chain: sepolia,
    transport: createRpcPool([rpc], { timeoutMs: 8_000, cooldownMs: 2_000 }),
  }) as VerifyFillClient;
}

function asNumber(value: unknown, label: string): number {
  const parsed = typeof value === "bigint" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed)) throw new Error(`${label} is not an integer`);
  return parsed;
}

/**
 * Read the settlement `Filled` log and recompute `receiptMath`.
 * `matchesReceipt` is true when that recomputation equals the log.
 */
export async function verifyFill(txHash: Hex, deps?: { client?: VerifyFillClient }): Promise<VerifyFillResult> {
  const deployment = rivalDeployment();
  const client = deps?.client ?? clientFromEnv();
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  let args:
    | {
        intentHash: Hex;
        maker: Address;
        solver: Address;
        tokenIn: Address;
        tokenOut: Address;
        amountIn: bigint;
        amountOut: bigint;
        fairOut: bigint;
        fairOutAfterFee: bigint;
        improvementBps: number | bigint;
        curveBps: number | bigint;
        elapsed: number | bigint;
      }
    | undefined;
  for (const entry of receipt.logs) {
    if (getLower(entry.address) !== getLower(deployment.settlement)) continue;
    try {
      const decoded = decodeEventLog({
        abi: [filled],
        data: entry.data,
        topics: entry.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName !== "Filled") continue;
      args = decoded.args;
      break;
    } catch {
      continue;
    }
  }
  if (!args) throw new Error("Filled log not found");

  const poolFee = asNumber(
    await client.readContract({
      address: deployment.settlement,
      abi: poolFeeAbi,
      functionName: "poolFee",
    }),
    "poolFee",
  );
  const curveBps = asNumber(args.curveBps, "curveBps");
  const elapsed = asNumber(args.elapsed, "elapsed");
  const loggedImprovement = asNumber(args.improvementBps, "improvementBps");
  if (!Number.isInteger(curveBps)) throw new Error("BadParams");
  const math = receiptMath({
    amountOut: args.amountOut,
    fairOut: args.fairOut,
    poolFee,
    elapsed,
  });
  return {
    txHash,
    intentHash: args.intentHash,
    maker: args.maker,
    solver: args.solver,
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
    amountIn: args.amountIn.toString(),
    amountOut: args.amountOut.toString(),
    fairOut: args.fairOut.toString(),
    fairOutAfterFee: math.fairOutAfterFee.toString(),
    improvementBps: math.improvementBps,
    curveBps,
    elapsed: math.elapsed,
    matchesReceipt: math.fairOutAfterFee === args.fairOutAfterFee && math.improvementBps === loggedImprovement,
  };
}

function getLower(value: string): string {
  return value.toLowerCase();
}
