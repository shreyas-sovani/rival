import { buildIntent } from "../../intent/src/build.ts";
import { createPublicClient, keccak256, parseUnits, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { CHAIN_ID, PERMIT2, rivalDeployment } from "./deployment.ts";
import { createRpcPool } from "./rpc-pool.ts";
import type { Intent } from "./types.ts";
import { permit2WitnessTypedData } from "./witness.ts";

const quoteAbi = [
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "zeroForOne", type: "bool" },
      { name: "amountIn", type: "uint128" },
      { name: "window", type: "uint32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface SignAndPublishOpts {
  sell: string;
  preset?: "fast" | "balanced" | "patient";
  gate?: "open" | "listed" | "named";
  labels?: string[];
  mode?: "absolute" | "pegged";
  key: Hex;
  rpc: string;
}

export interface SignAndPublishResult {
  intentHash: Hex;
  entityKey?: string;
  degraded: boolean;
}

export interface PublishDeps {
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  quoteOut?: bigint;
  now?: number;
  nonce?: bigint;
}

/** Same origin rule as the web client: `NEXT_PUBLIC_RUNNER_URL`, otherwise the deployment record. */
export function runnerOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_RUNNER_URL;
  if (typeof configured === "string" && configured.trim() !== "") {
    return configured.trim().replace(/\/$/, "");
  }
  const recorded = rivalDeployment().runnerUrl.trim();
  if (recorded !== "") return recorded.replace(/\/$/, "");
  return "https://rival-runner.fly.dev";
}

function gateOf(gate: SignAndPublishOpts["gate"]): 0 | 1 | 2 {
  if (gate === "listed") return 1;
  if (gate === "named") return 2;
  return 0;
}

function modeOf(mode: SignAndPublishOpts["mode"]): 0 | 1 {
  if (mode === "absolute") return 0;
  return 1;
}

function intentToWire(intent: Intent) {
  return {
    maker: intent.maker,
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amountIn.toString(),
    recipient: intent.recipient,
    mode: intent.mode,
    baseOut: intent.baseOut.toString(),
    oracleWindow: intent.oracleWindow,
    startBps: intent.startBps,
    floorBps: intent.floorBps,
    startTime: intent.startTime,
    decaySecs: intent.decaySecs,
    deadline: intent.deadline,
    hardMinOut: intent.hardMinOut.toString(),
    gate: intent.gate,
    allowlistHash: intent.allowlistHash,
    nonce: intent.nonce.toString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.message === "string" && body.message.trim() !== "") return body.message;
  } catch {
    // Non-JSON bodies stay on the status line.
  }
  return `Request failed (${response.status})`;
}

async function readQuote(rpc: string, amountIn: bigint): Promise<bigint> {
  const deployment = rivalDeployment();
  const client = createPublicClient({
    chain: sepolia,
    transport: createRpcPool([rpc], { timeoutMs: 8_000, cooldownMs: 2_000 }),
  });
  const pool = deployment.poolA;
  const quoted = await client.readContract({
    address: deployment.hook,
    abi: quoteAbi,
    functionName: "quote",
    args: [
      {
        currency0: pool.currency0,
        currency1: pool.currency1,
        fee: pool.fee,
        tickSpacing: pool.tickSpacing,
        hooks: pool.hooks,
      },
      pool.currency0.toLowerCase() === deployment.tokens.tWETH.toLowerCase(),
      amountIn,
      60,
    ],
  });
  if (typeof quoted !== "bigint" || quoted <= 0n) throw new Error("oracle quote is missing");
  return quoted;
}

/** Sign a tWETH intent and POST `{ intent, signature }` to the runner, matching the web client. */
export async function signAndPublish(opts: SignAndPublishOpts, deps?: PublishDeps): Promise<SignAndPublishResult> {
  const account = privateKeyToAccount(opts.key);
  const deployment = rivalDeployment();
  const now = deps?.now ?? Math.floor(Date.now() / 1000);
  const mode = modeOf(opts.mode);
  const gate = gateOf(opts.gate);
  const amountIn = parseUnits(opts.sell, 18);
  if (amountIn <= 0n) throw new Error("sell must be a positive tWETH amount");
  const quoteOut = deps?.quoteOut ?? (await readQuote(opts.rpc, amountIn));
  if (quoteOut <= 0n) throw new Error("oracle quote is missing");
  const allowLabels = (opts.labels ?? []).map((label) => keccak256(toBytes(label)));
  const intent = buildIntent({
    maker: account.address,
    tokenIn: deployment.tokens.tWETH,
    tokenOut: deployment.tokens.tUSDC,
    amountIn,
    recipient: account.address,
    preset: opts.preset ?? "balanced",
    mode,
    gate,
    startTime: now,
    nonce: deps?.nonce ?? BigInt(now),
    oracleQuoteOut: quoteOut,
    baseOut: mode === 0 ? quoteOut : 0n,
    ...(gate === 2 ? { allowLabels } : {}),
  });
  const typed = permit2WitnessTypedData({
    intent,
    permit2: PERMIT2,
    settlement: deployment.settlement,
    chainId: CHAIN_ID,
  });
  const signature = await account.signTypedData({
    domain: typed.domain,
    types: typed.types,
    primaryType: typed.primaryType,
    message: typed.message,
  });
  const fetchImpl = deps?.fetch ?? fetch;
  const response = await fetchImpl(`${runnerOrigin()}/api/intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intent: intentToWire(intent), signature }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const parsed: unknown = await response.json();
  if (!isRecord(parsed) || typeof parsed.degraded !== "boolean") {
    throw new Error("publish response is missing degraded");
  }
  if (typeof parsed.intentHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.intentHash)) {
    throw new Error("intentHash is not a bytes32");
  }
  const result: SignAndPublishResult = { intentHash: parsed.intentHash as Hex, degraded: parsed.degraded };
  if (typeof parsed.entityKey === "string" && parsed.entityKey !== "") result.entityKey = parsed.entityKey;
  return result;
}
