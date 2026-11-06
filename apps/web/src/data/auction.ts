import { receiptMath, requiredAt, type Intent } from "@rival/intent";
import { parseAbiItem, type Address, type Hash, type Hex, type PublicClient } from "viem";
import { formatUnitsFixed, shortHex } from "../lib/format.ts";
import type { CurveChartVM } from "../viewmodels/curve.ts";
import type { EventVM } from "../viewmodels/common.ts";
import type { ReceiptVM } from "../viewmodels/receipt.ts";
import { requiredOutputsAt } from "./curve.ts";
import { withSepolia } from "./live-market.ts";
import { publicDeployment } from "./public-deployment.ts";
import { settlementAddress } from "./runner.ts";

const NO_SIGNED_INTENT = "This browser has no signed intent for this hash. Sign on the Trade page.";

/** Status a judge reads when this browser has no stored signed intent for a valid hash. */
export function auctionStatusCopy(args: {
  hashValid: boolean;
  hasStoredIntent: boolean;
  phase: "waiting" | "filled" | "cancelled" | "expired";
  curveEmpty: boolean;
}): { phaseLabel: string; banner?: string } {
  if (!args.hashValid) return { phaseLabel: "Open this page with an intent hash." };
  const noLocal = !args.hasStoredIntent;
  const phaseLabel =
    args.phase === "filled"
      ? "Filled"
      : args.phase === "cancelled"
        ? "Cancelled"
        : args.phase === "expired"
          ? "Expired"
          : noLocal
            ? NO_SIGNED_INTENT
            : args.curveEmpty
              ? "Waiting for chain events"
              : "Live auction";
  if (noLocal) return { phaseLabel, banner: NO_SIGNED_INTENT };
  return { phaseLabel };
}

const BUY_DECIMALS = 6;
const SELL_DECIMALS = 18;
const POOL_FEE = publicDeployment.pools.A.fee;
const LOOKBACK = 200_000n;

const filledEvent = parseAbiItem(
  "event Filled(bytes32 indexed intentHash, address indexed maker, address indexed solver, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fairOut, uint256 fairOutAfterFee, int32 improvementBps, int32 curveBps, uint32 elapsed)",
);
const cancelledEvent = parseAbiItem(
  "event Cancelled(bytes32 indexed intentHash, address indexed maker)",
);
const statusAbi = parseAbiItem("function status(bytes32 intentHash_) view returns (uint8)");

export interface FillLog {
  intentHash: Hex;
  maker: Address;
  solver: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  fairOut: bigint;
  curveBps: number;
  elapsed: number;
  txHash: Hash;
  blockNumber: bigint;
}

export interface AuctionSnapshot {
  phase: "waiting" | "filled" | "cancelled" | "expired";
  status: number;
  fill?: FillLog;
  cancelTx?: Hash;
}

function sampleTimestamps(decaySecs: number): number[] {
  const count = 20;
  const points: number[] = [];
  const seen = new Set<number>();
  const last = count - 1;
  for (let i = 0; i < count; i++) {
    let ts = Math.round((decaySecs * i) / last);
    while (seen.has(ts)) ts += 1;
    seen.add(ts);
    points.push(ts);
  }
  return points;
}

function money(value: bigint | null, symbol: string): string {
  if (value === null) return "unavailable";
  return `${formatUnitsFixed(value, BUY_DECIMALS, 4)} ${symbol}`;
}

/** Full decay series from `requiredAt`. `tSec` is seconds after `startTime`. */
export function curveForIntent(args: {
  intent: Pick<Intent, "mode" | "baseOut" | "startBps" | "floorBps" | "startTime" | "decaySecs" | "hardMinOut">;
  quoteOut: bigint;
  poolOut: bigint | null;
  twapOut: bigint | null;
  buySymbol?: string;
  fill?: { tSec: number; value: string };
}): CurveChartVM {
  const buySymbol = args.buySymbol ?? "tUSDC";
  const offsets = sampleTimestamps(args.intent.decaySecs);
  const timestamps = offsets.map((offset) => args.intent.startTime + offset);
  const outputs = requiredOutputsAt(args.intent, timestamps, args.quoteOut);
  const requiredOut = outputs.flatMap((value, index) => {
    const tSec = offsets[index];
    if (tSec === undefined) return [];
    return [{ tSec, value: formatUnitsFixed(value, BUY_DECIMALS, 4) }];
  });
  return {
    requiredOut,
    poolQuote: { label: "Pool", value: money(args.poolOut, buySymbol) },
    twap: { label: "TWAP", value: money(args.twapOut, buySymbol) },
    hardFloor: { label: "Floor", value: formatUnitsFixed(args.intent.hardMinOut, BUY_DECIMALS, 4) },
    ...(args.fill ? { fill: { tSec: args.fill.tSec, value: args.fill.value, label: "Fill" } } : {}),
    yUnit: buySymbol,
    empty: requiredOut.length === 0,
  };
}

/** Receipt card from the Filled log plus `receiptMath`. Solver name stays blank without ENS. */
export function receiptFromFill(args: {
  fill: FillLog;
  intent?: Intent;
  quoteOut?: bigint;
  poolDirectAtSign: string;
  entityKey?: string;
}): ReceiptVM {
  let curveBps = args.fill.curveBps;
  if (args.intent && args.quoteOut !== undefined) {
    curveBps = requiredAt({
      mode: args.intent.mode,
      baseOut: args.intent.baseOut,
      quoteOut: args.quoteOut,
      startBps: args.intent.startBps,
      floorBps: args.intent.floorBps,
      startTime: args.intent.startTime,
      decaySecs: args.intent.decaySecs,
      hardMinOut: args.intent.hardMinOut,
      ts: args.intent.startTime + args.fill.elapsed,
    }).curveBps;
  }
  const math = receiptMath({
    amountOut: args.fill.amountOut,
    fairOut: args.fill.fairOut,
    poolFee: POOL_FEE,
    curveBps,
    elapsed: args.fill.elapsed,
  });
  const sellDecimals = args.fill.tokenIn.toLowerCase() === publicDeployment.tokens.tUSDC.toLowerCase() ? BUY_DECIMALS : SELL_DECIMALS;
  const buyDecimals = args.fill.tokenOut.toLowerCase() === publicDeployment.tokens.tWETH.toLowerCase() ? SELL_DECIMALS : BUY_DECIMALS;
  const receipt: ReceiptVM = {
    intentHash: args.fill.intentHash,
    amountIn: formatUnitsFixed(args.fill.amountIn, sellDecimals, 4),
    amountOut: formatUnitsFixed(args.fill.amountOut, buyDecimals, 4),
    curveBps: String(curveBps),
    fairOut: formatUnitsFixed(math.fairOut, buyDecimals, 4),
    fairOutAfterFee: formatUnitsFixed(math.fairOutAfterFee, buyDecimals, 4),
    improvementBps: String(math.improvementBps),
    elapsed: `${math.elapsed}s`,
    solverName: "",
    solverLink: {
      chain: "sepolia",
      kind: "address",
      value: args.fill.solver,
      href: `https://sepolia.etherscan.io/address/${args.fill.solver}`,
      label: shortHex(args.fill.solver),
    },
    tx: {
      chain: "sepolia",
      kind: "tx",
      value: args.fill.txHash,
      href: `https://sepolia.etherscan.io/tx/${args.fill.txHash}`,
      label: "View transaction",
    },
    poolDirectAtSign: args.poolDirectAtSign,
  };
  if (args.entityKey) {
    receipt.entity = {
      chain: "rabdi",
      kind: "entity",
      value: args.entityKey,
      href: `https://rabdi.explorer.arkiv.network/entity/${args.entityKey}`,
      label: "View entity",
    };
  }
  return receipt;
}

export function auctionEvents(args: {
  publishedAt?: string;
  entityKey?: string;
  fill?: FillLog;
  cancelTx?: Hash;
  expired?: boolean;
}): EventVM[] {
  const events: EventVM[] = [];
  if (args.publishedAt) {
    const published: EventVM = { id: "published", at: args.publishedAt, text: "Published", tone: "info" };
    if (args.entityKey) {
      published.link = {
        chain: "rabdi",
        kind: "entity",
        value: args.entityKey,
        href: `https://rabdi.explorer.arkiv.network/entity/${args.entityKey}`,
        label: "View entity",
      };
    }
    events.push(published);
  }
  if (args.fill) {
    events.push({
      id: `filled-${args.fill.txHash}`,
      at: new Date().toISOString(),
      text: "Filled",
      tone: "ok",
      link: {
        chain: "sepolia",
        kind: "tx",
        value: args.fill.txHash,
        href: `https://sepolia.etherscan.io/tx/${args.fill.txHash}`,
        label: "View transaction",
      },
    });
  }
  if (args.cancelTx) {
    events.push({
      id: `cancelled-${args.cancelTx}`,
      at: new Date().toISOString(),
      text: "Cancelled",
      tone: "warn",
      link: {
        chain: "sepolia",
        kind: "tx",
        value: args.cancelTx,
        href: `https://sepolia.etherscan.io/tx/${args.cancelTx}`,
        label: "View transaction",
      },
    });
  }
  if (args.expired && !args.fill && !args.cancelTx) {
    events.push({ id: "expired", at: new Date().toISOString(), text: "Expired", tone: "warn" });
  }
  return events;
}

async function fromBlock(client: PublicClient): Promise<bigint> {
  const latest = await client.getBlockNumber();
  return latest > LOOKBACK ? latest - LOOKBACK : 0n;
}

function asFill(log: {
  args: {
    intentHash?: Hex;
    maker?: Address;
    solver?: Address;
    tokenIn?: Address;
    tokenOut?: Address;
    amountIn?: bigint;
    amountOut?: bigint;
    fairOut?: bigint;
    curveBps?: number;
    elapsed?: number;
  };
  transactionHash: Hash | null;
  blockNumber: bigint | null;
}): FillLog | null {
  const args = log.args;
  if (
    !args.intentHash ||
    !args.maker ||
    !args.solver ||
    !args.tokenIn ||
    !args.tokenOut ||
    args.amountIn === undefined ||
    args.amountOut === undefined ||
    args.fairOut === undefined ||
    args.curveBps === undefined ||
    args.elapsed === undefined ||
    !log.transactionHash ||
    log.blockNumber === null
  ) {
    return null;
  }
  return {
    intentHash: args.intentHash,
    maker: args.maker,
    solver: args.solver,
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
    amountIn: args.amountIn,
    amountOut: args.amountOut,
    fairOut: args.fairOut,
    curveBps: args.curveBps,
    elapsed: args.elapsed,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
  };
}

/** Filled and Cancelled logs for one hash, plus on-chain status. Expired is the deadline, not a log. */
export async function readAuction(intentHash: Hex, deadline?: number, nowUnix = Math.floor(Date.now() / 1000)): Promise<AuctionSnapshot> {
  const settlement = settlementAddress();
  return withSepolia(async (client) => {
    const start = await fromBlock(client);
    const [status, filledLogs, cancelledLogs] = await Promise.all([
      client.readContract({
        address: settlement,
        abi: [statusAbi],
        functionName: "status",
        args: [intentHash],
      }),
      client.getLogs({
        address: settlement,
        event: filledEvent,
        args: { intentHash },
        fromBlock: start,
        toBlock: "latest",
      }),
      client.getLogs({
        address: settlement,
        event: cancelledEvent,
        args: { intentHash },
        fromBlock: start,
        toBlock: "latest",
      }),
    ]);
    const fills = filledLogs.flatMap((log) => {
      const fill = asFill(log);
      return fill ? [fill] : [];
    });
    fills.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
    const fill = fills[0];
    const cancel = cancelledLogs[cancelledLogs.length - 1];
    const onchain = Number(status);
    if (fill) return { phase: "filled", status: onchain, fill };
    if (onchain === 1) return { phase: "filled", status: onchain };
    if (onchain === 2 || cancel) {
      return {
        phase: "cancelled",
        status: onchain,
        ...(cancel?.transactionHash ? { cancelTx: cancel.transactionHash } : {}),
      };
    }
    if (deadline !== undefined && nowUnix > deadline) {
      return { phase: "expired", status: onchain };
    }
    return { phase: "waiting", status: onchain };
  });
}

export async function latestFillTx(solver: Address): Promise<Hash | undefined> {
  const settlement = settlementAddress();
  return withSepolia(async (client) => {
    const start = await fromBlock(client);
    const logs = await client.getLogs({
      address: settlement,
      event: filledEvent,
      args: { solver },
      fromBlock: start,
      toBlock: "latest",
    });
    let best: { block: bigint; hash: Hash } | undefined;
    for (const log of logs) {
      if (log.blockNumber === null || !log.transactionHash) continue;
      if (!best || log.blockNumber > best.block) best = { block: log.blockNumber, hash: log.transactionHash };
    }
    return best?.hash;
  });
}
