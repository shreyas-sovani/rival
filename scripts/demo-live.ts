/**
 * One-shot Sepolia demo: warm pool A, register atlas, send one ABSOLUTE fill.
 * Prints hashes and statuses only. Does not print keys or RPC URLs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "../packages/solver-sdk/node_modules/viem/_esm/index.js";
import { privateKeyToAccount } from "../packages/solver-sdk/node_modules/viem/_esm/accounts/index.js";
import { sepolia } from "../packages/solver-sdk/node_modules/viem/_esm/chains/index.js";
import { encodeFill } from "../packages/solver-sdk/src/fill.ts";
import { permit2WitnessTypedData } from "../packages/solver-sdk/src/witness.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TWETH = getAddress("0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d");
const TUSDC = getAddress("0x571c992873D31310B11Bf6bF6B44f2748B4bce8C");
const HOOK = getAddress("0xb17a547082836fDF87001c1DE031fA8A2D391080");
const POOL_A = "0xd302ad11d027e1897d14162ac1d7a583a7c48a12a547a25c12c9bb1da504f13f" as Hex;
const SETTLEMENT = getAddress("0xdD66D017e4B4FfF51aBEf2f559C68065D4FD9850");
const SOLVER = getAddress("0xDBe8a61e1A4cDd767FfA7C822C242B8E85414e17");
const REGISTRY = getAddress("0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E");
const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
const SWAP_HELPER = getAddress("0x9b6b46e2c869aa39918db7f52f5557fe577b6eee");
const POOL_MANAGER = getAddress("0xE03A1074c86CFeDd5C142C4F04F1a1536e203543");
const DEPOSIT = 100_000_000n;
const SWAP_IN = 10n ** 15n;
const MIN_SQRT = 4295128739n;
const MAX_SQRT = 1461446703485210103287273052203988822378723970342n;
const GAS_MULTIPLIER = 800n;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;

const tokenAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const hookAbi = parseAbi([
  "function consult((address,address,uint24,int24,address) key, uint32 window) view returns (int24)",
  "function oldestTimestamp(bytes32 id) view returns (uint32)",
]);
const swapAbi = parseAbi([
  "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, (bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) payable returns (int256)",
]);
const registryAbi = parseAbi([
  "function register(string label)",
  "function labelOf(address solver) view returns (string)",
  "function isListed(address solver) view returns (bool)",
]);
const permit2Abi = parseAbi([
  "function nonceBitmap(address owner, uint256 wordPos) view returns (uint256)",
]);
const quoteAbi = parseAbi([
  "function quoteExactInputSingle(((address,address,uint24,int24,address),bool,uint128,bytes)) view returns (uint256 amountOut, uint256 gasEstimate)",
]);

type StepName = "warm" | "register" | "fill";
type StepStatus = "DONE" | "BLOCKED";

interface StepReport {
  status: StepStatus;
  lines: string[];
}

const poolKey = {
  currency0: TWETH,
  currency1: TUSDC,
  fee: 500,
  tickSpacing: 10,
  hooks: HOOK,
} as const;

function loadEnv(secrets: string[]): Map<string, string> {
  const text = readFileSync(path.join(root, "secrets/.env.local"), "utf8");
  const values = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const body = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eq = body.indexOf("=");
    if (eq < 0) continue;
    const name = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(name, value);
    if (/KEY|RPC|SECRET|TOKEN/i.test(name) && value.length > 8) secrets.push(value);
  }
  return values;
}

function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length > 0) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/https?:\/\/\S+/g, "[redacted-url]");
}

function explain(error: unknown, secrets: string[]): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as {
      shortMessage?: string;
      details?: string;
      reason?: string;
      message?: string;
      cause?: unknown;
    };
    if (record.shortMessage) parts.push(record.shortMessage);
    if (record.details) parts.push(record.details);
    if (record.reason) parts.push(record.reason);
    if (parts.length === 0 && record.message) parts.push(record.message);
    current = record.cause;
  }
  if (parts.length === 0) parts.push(String(error));
  return redact(parts.join(" | "), secrets).slice(0, 700);
}

function requireKey(values: Map<string, string>, name: string): Hex {
  const value = values.get(name);
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`missing ${name}`);
  }
  return value as Hex;
}

function poolKeyTuple() {
  return [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks] as const;
}

async function consult(
  client: PublicClient,
  secrets: string[],
): Promise<{ ok: true; tick: string } | { ok: false; reason: string }> {
  try {
    const tick = await client.readContract({
      address: HOOK,
      abi: hookAbi,
      functionName: "consult",
      args: [poolKeyTuple(), 60],
    });
    return { ok: true, tick: tick.toString() };
  } catch (error) {
    return { ok: false, reason: explain(error, secrets) };
  }
}

async function oldestTimestamp(client: PublicClient): Promise<string> {
  const ts = await client.readContract({
    address: HOOK,
    abi: hookAbi,
    functionName: "oldestTimestamp",
    args: [POOL_A],
  });
  return ts.toString();
}

type Account = ReturnType<typeof privateKeyToAccount>;

async function send(
  client: PublicClient,
  account: Account,
  request: {
    to: Address;
    data?: Hex;
    value?: bigint;
    authorizationList?: readonly {
      address: Address;
      chainId: number;
      nonce: number;
      r: Hex;
      s: Hex;
      yParity: number;
    }[];
    nonce?: number;
  },
  secrets: string[],
): Promise<{ hash: Hex | null; ok: boolean; reason: string }> {
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl, { retryCount: 0, timeout: 30_000 }),
  });
  let gas: bigint;
  try {
    const estimated = await client.estimateGas({ account, ...request });
    gas = (estimated * GAS_MULTIPLIER) / 100n;
  } catch (error) {
    return { hash: null, ok: false, reason: explain(error, secrets) };
  }
  let hash: Hex;
  try {
    hash = await wallet.sendTransaction({ account, chain: sepolia, ...request, gas });
  } catch (error) {
    return { hash: null, ok: false, reason: explain(error, secrets) };
  }
  let receipt: TransactionReceipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
  } catch (error) {
    return { hash, ok: false, reason: explain(error, secrets) };
  }
  return {
    hash,
    ok: receipt.status === "success",
    reason: receipt.status === "success" ? "" : "transaction reverted",
  };
}

function writeDocs(steps: Record<StepName, StepReport>, secrets: string[]): void {
  const body = [
    "# Live Sepolia demo",
    "",
    "Pool A, the oracle hook, RivalSettlement, and UniswapSolver. Hashes and statuses only.",
    "",
    "## Step 1 — warm pool A",
    "",
    `Status: ${steps.warm.status}`,
    "",
    ...steps.warm.lines,
    "",
    "## Step 2 — register solver",
    "",
    `Status: ${steps.register.status}`,
    "",
    ...steps.register.lines,
    "",
    "## Step 3 — absolute fill",
    "",
    `Status: ${steps.fill.status}`,
    "",
    ...steps.fill.lines,
    "",
  ].join("\n");
  writeFileSync(path.join(root, "docs/demo.md"), redact(body, secrets));
}

function recordSolver(address: Address): void {
  const file = path.join(root, "deployments/sepolia.json");
  const before = readFileSync(file, "utf8");
  const parsed = JSON.parse(before) as {
    tokens: { tWETH: string; tUSDC: string };
    hook: unknown;
    pools: unknown;
    settlement: string;
    registry: string;
    names: string;
    solvers: { label: string; address: string; strategy: string }[];
  };
  const already = parsed.solvers.find((solver) => solver.label === "atlas");
  if (already && getAddress(already.address) === address) return;
  if (!before.includes('"solvers": []')) {
    throw new Error("solvers array is not empty");
  }
  const entry = `{
      "label": "atlas",
      "address": "${address}",
      "strategy": "sprint"
    }`;
  const next = before.replace('"solvers": []', `"solvers": [\n    ${entry}\n  ]`);
  const after = JSON.parse(next) as typeof parsed;
  if (after.tokens.tWETH !== parsed.tokens.tWETH || after.tokens.tUSDC !== parsed.tokens.tUSDC) {
    throw new Error("refusing to change tokens");
  }
  if (JSON.stringify(after.hook) !== JSON.stringify(parsed.hook)) throw new Error("refusing to change hook");
  if (JSON.stringify(after.pools) !== JSON.stringify(parsed.pools)) throw new Error("refusing to change pools");
  if (after.settlement !== parsed.settlement || after.registry !== parsed.registry || after.names !== parsed.names) {
    throw new Error("refusing to change settlement, registry, or names");
  }
  writeFileSync(file, next);
}

let rpcUrl = "";

async function main(): Promise<void> {
  const secrets: string[] = [];
  const env = loadEnv(secrets);
  const rpc = env.get("SEPOLIA_RPC_URL");
  if (!rpc) throw new Error("missing SEPOLIA_RPC_URL");
  secrets.push(rpc);
  rpcUrl = rpc;

  const operator = privateKeyToAccount(requireKey(env, "OPERATOR_PRIVATE_KEY"));
  const mm = privateKeyToAccount(requireKey(env, "MM_PRIVATE_KEY"));
  const atlas = privateKeyToAccount(requireKey(env, "SOLVER_ATLAS_PRIVATE_KEY"));
  const maker = privateKeyToAccount(requireKey(env, "MAKERBOT_1_PRIVATE_KEY"));
  if (operator.address !== getAddress("0xFeAf5C921996FC53f4DEf35e181E766e6D74690A")) {
    throw new Error("operator address mismatch");
  }
  if (atlas.address !== getAddress(env.get("SOLVER_ATLAS_ADDRESS") ?? atlas.address)) {
    throw new Error("atlas address mismatch");
  }
  if (maker.address !== getAddress(env.get("MAKERBOT_1_ADDRESS") ?? maker.address)) {
    throw new Error("maker address mismatch");
  }

  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpc, { retryCount: 1, timeout: 30_000 }),
    pollingInterval: 4_000,
  });

  const steps: Record<StepName, StepReport> = {
    warm: { status: "BLOCKED", lines: [] },
    register: { status: "BLOCKED", lines: [] },
    fill: { status: "BLOCKED", lines: [] },
  };

  const note = (step: StepName, line: string) => {
    steps[step].lines.push(line);
    console.log(step, redact(line, secrets));
  };

  try {
    await warm(client, operator, mm, steps, secrets, note);
  } catch (error) {
    steps.warm.status = "BLOCKED";
    note("warm", `Stopped: ${explain(error, secrets)}`);
  }
  writeDocs(steps, secrets);

  try {
    await register(client, operator, atlas, steps, secrets, note);
  } catch (error) {
    steps.register.status = "BLOCKED";
    note("register", `Stopped: ${explain(error, secrets)}`);
  }
  writeDocs(steps, secrets);

  try {
    await fill(client, operator, atlas, maker, steps, secrets, note);
  } catch (error) {
    steps.fill.status = "BLOCKED";
    note("fill", `Stopped: ${explain(error, secrets)}`);
  }
  writeDocs(steps, secrets);

  console.log(
    ["warm", steps.warm.status, "register", steps.register.status, "fill", steps.fill.status].join(" "),
  );
}

async function warm(
  client: PublicClient,
  operator: Account,
  mm: Account,
  steps: Record<StepName, StepReport>,
  secrets: string[],
  note: (step: StepName, line: string) => void,
): Promise<void> {
  const started = Date.now();
  const before = await consult(client, secrets);
  const oldest = await oldestTimestamp(client);
  note("warm", `Oldest observation timestamp: ${oldest}.`);
  note(
    "warm",
    before.ok
      ? `consult(pool A, 60) before swaps: works, tick ${before.tick}.`
      : `consult(pool A, 60) before swaps: reverts (${before.reason}).`,
  );

  const mint = await send(
    client,
    operator,
    {
      to: TWETH,
      data: encodeFunctionData({
        abi: tokenAbi,
        functionName: "mint",
        args: [mm.address, SWAP_IN * 20n],
      }),
    },
    secrets,
  );
  if (!mint.ok || !mint.hash) {
    note("warm", `Mint tWETH to the market maker reverted: ${mint.reason}`);
    return;
  }
  note("warm", `Mint tWETH for warming swaps: ${mint.hash}`);

  for (const token of [TWETH, TUSDC]) {
    const allowance = await client.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "allowance",
      args: [mm.address, SWAP_HELPER],
    });
    if (allowance > SWAP_IN * 10n) continue;
    const approved = await send(
      client,
      mm,
      {
        to: token,
        data: encodeFunctionData({
          abi: tokenAbi,
          functionName: "approve",
          args: [SWAP_HELPER, 2n ** 256n - 1n],
        }),
      },
      secrets,
    );
    if (!approved.ok || !approved.hash) {
      note("warm", `PoolSwapTest approval reverted: ${approved.reason}`);
      return;
    }
    note("warm", `Approve PoolSwapTest ${token}: ${approved.hash}`);
  }

  const zeroForOne = await swap(client, mm, true, -SWAP_IN, secrets);
  note(
    "warm",
    zeroForOne.ok && zeroForOne.hash
      ? `Swap tWETH to tUSDC: ${zeroForOne.hash}`
      : `Swap tWETH to tUSDC reverted: ${zeroForOne.reason}`,
  );
  const usdcBack = 1_000_000n;
  const oneForZero = await swap(client, mm, false, -usdcBack, secrets);
  note(
    "warm",
    oneForZero.ok && oneForZero.hash
      ? `Swap tUSDC to tWETH: ${oneForZero.hash}`
      : `Swap tUSDC to tWETH reverted: ${oneForZero.reason}`,
  );

  let seen = await consult(client, secrets);
  while (!seen.ok && Date.now() - started < 120_000) {
    await new Promise((resolve) => setTimeout(resolve, 12_000));
    seen = await consult(client, secrets);
  }
  const oldestAfter = await oldestTimestamp(client);
  note("warm", `Oldest observation timestamp after swaps: ${oldestAfter}.`);
  if (seen.ok && zeroForOne.ok && oneForZero.ok) {
    steps.warm.status = "DONE";
    note("warm", `consult(pool A, 60) works, tick ${seen.tick}.`);
    return;
  }
  if (seen.ok) {
    note("warm", `consult(pool A, 60) works, tick ${seen.tick}. A directional swap reverted.`);
  } else {
    note("warm", `consult(pool A, 60) still reverts after the two-minute cap: ${seen.reason}`);
  }
  steps.warm.status = "BLOCKED";
}

async function swap(
  client: PublicClient,
  mm: Account,
  zeroForOne: boolean,
  amountSpecified: bigint,
  secrets: string[],
): Promise<{ hash: Hex | null; ok: boolean; reason: string }> {
  const data = encodeFunctionData({
    abi: swapAbi,
    functionName: "swap",
    args: [
      poolKey,
      {
        zeroForOne,
        amountSpecified,
        sqrtPriceLimitX96: zeroForOne ? MIN_SQRT + 1n : MAX_SQRT - 1n,
      },
      { takeClaims: false, settleUsingBurn: false },
      "0x",
    ],
  });
  return send(client, mm, { to: SWAP_HELPER, data }, secrets);
}

async function register(
  client: PublicClient,
  operator: Account,
  atlas: Account,
  steps: Record<StepName, StepReport>,
  secrets: string[],
  note: (step: StepName, line: string) => void,
): Promise<void> {
  const existing = await client.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "labelOf",
    args: [atlas.address],
  });
  note("register", `Solver label: atlas. Address: ${atlas.address}.`);
  if (existing === "atlas") {
    steps.register.status = "DONE";
    note("register", "Registry already stores label atlas. No second register transaction.");
    recordSolver(atlas.address);
    return;
  }

  const minted = await send(
    client,
    operator,
    {
      to: TUSDC,
      data: encodeFunctionData({
        abi: tokenAbi,
        functionName: "mint",
        args: [atlas.address, DEPOSIT],
      }),
    },
    secrets,
  );
  if (!minted.ok || !minted.hash) {
    note("register", `Mint 100 tUSDC reverted: ${minted.reason}`);
    return;
  }
  note("register", `Mint 100 tUSDC: ${minted.hash}`);

  const approved = await send(
    client,
    atlas,
    {
      to: TUSDC,
      data: encodeFunctionData({
        abi: tokenAbi,
        functionName: "approve",
        args: [REGISTRY, DEPOSIT],
      }),
    },
    secrets,
  );
  if (!approved.ok || !approved.hash) {
    note("register", `Registry approval reverted: ${approved.reason}`);
    return;
  }
  note("register", `Approve registry: ${approved.hash}`);

  const registered = await send(
    client,
    atlas,
    {
      to: REGISTRY,
      data: encodeFunctionData({
        abi: registryAbi,
        functionName: "register",
        args: ["atlas"],
      }),
    },
    secrets,
  );
  if (!registered.ok || !registered.hash) {
    note("register", `register("atlas") reverted: ${registered.reason}`);
    return;
  }
  const label = await client.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "labelOf",
    args: [atlas.address],
  });
  if (label !== "atlas") {
    note("register", `register transaction ${registered.hash} mined but labelOf is ${JSON.stringify(label)}.`);
    return;
  }
  recordSolver(atlas.address);
  steps.register.status = "DONE";
  note("register", `register("atlas"): ${registered.hash}`);
}

async function unusedNonce(client: PublicClient, owner: Address): Promise<bigint> {
  let nonce = BigInt(Date.now());
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const word = nonce >> 8n;
    const bit = nonce & 255n;
    const bitmap = await client.readContract({
      address: PERMIT2,
      abi: permit2Abi,
      functionName: "nonceBitmap",
      args: [owner, word],
    });
    if (((bitmap >> bit) & 1n) === 0n) return nonce;
    nonce += 1n;
  }
  throw new Error("no free Permit2 nonce");
}

async function fill(
  client: PublicClient,
  operator: Account,
  atlas: Account,
  maker: Account,
  steps: Record<StepName, StepReport>,
  secrets: string[],
  note: (step: StepName, line: string) => void,
): Promise<void> {
  const minted = await send(
    client,
    operator,
    {
      to: TWETH,
      data: encodeFunctionData({
        abi: tokenAbi,
        functionName: "mint",
        args: [maker.address, SWAP_IN],
      }),
    },
    secrets,
  );
  if (!minted.ok || !minted.hash) {
    note("fill", `Mint maker tWETH reverted: ${minted.reason}`);
    return;
  }
  note("fill", `Mint maker tWETH: ${minted.hash}`);

  const allowance = await client.readContract({
    address: TWETH,
    abi: tokenAbi,
    functionName: "allowance",
    args: [maker.address, PERMIT2],
  });
  if (allowance < SWAP_IN) {
    const approved = await send(
      client,
      maker,
      {
        to: TWETH,
        data: encodeFunctionData({
          abi: tokenAbi,
          functionName: "approve",
          args: [PERMIT2, 2n ** 256n - 1n],
        }),
      },
      secrets,
    );
    if (!approved.ok || !approved.hash) {
      note("fill", `Permit2 approval reverted: ${approved.reason}`);
      return;
    }
    note("fill", `Approve Permit2: ${approved.hash}`);
  } else {
    note("fill", "Maker tWETH allowance for Permit2 is already max.");
  }

  const makerWeth = await client.readContract({
    address: TWETH,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: [atlas.address],
  });
  if (makerWeth !== 0n) {
    note("fill", "Atlas already holds tWETH, so the solver callback would revert Shortfall.");
    return;
  }

  let quoted = 0n;
  try {
    const quote = await client.readContract({
      address: getAddress("0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244"),
      abi: quoteAbi,
      functionName: "quoteExactInputSingle",
      args: [[poolKeyTuple(), true, SWAP_IN, "0x"]],
    });
    quoted = quote[0];
  } catch (error) {
    note("fill", `Quoter reverted, using a fixed floor under the recorded pool output: ${explain(error, secrets)}`);
  }
  const baseOut = quoted > 0n ? (quoted * 70n) / 100n : 1_500_000n;
  const hardMinOut = quoted > 0n ? (quoted * 60n) / 100n : 1_000_000n;
  const block = await client.getBlock();
  const startTime = Number(block.timestamp);
  const intent = {
    maker: maker.address,
    tokenIn: TWETH,
    tokenOut: TUSDC,
    amountIn: SWAP_IN,
    recipient: maker.address,
    mode: 0 as const,
    baseOut,
    oracleWindow: 0,
    startBps: 20,
    floorBps: -20,
    startTime,
    decaySecs: 10,
    deadline: startTime + 600,
    hardMinOut,
    gate: 0 as const,
    allowlistHash: ZERO_BYTES32,
    nonce: await unusedNonce(client, maker.address),
  };
  const signature = await maker.signTypedData(
    permit2WitnessTypedData({
      intent,
      permit2: PERMIT2,
      settlement: SETTLEMENT,
      chainId: sepolia.id,
    }),
  );
  const callbackData = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    [poolKey],
  );
  const encoded = encodeFill(intent, signature, {
    inputTo: atlas.address,
    useCallback: true,
    data: callbackData,
    allowLabels: [],
  });
  note(
    "fill",
    `ABSOLUTE curve 10s, start +20 bps, floor -20 bps, hard floor ${hardMinOut.toString()} tUSDC base units.`,
  );

  const txNonce = await client.getTransactionCount({ address: atlas.address, blockTag: "pending" });
  let chosen:
    | {
        authorization: Awaited<ReturnType<Account["signAuthorization"]>>;
        nonce: number;
      }
    | undefined;
  let lastReason = "no authorization nonce simulated";
  for (const offset of [1, 0]) {
    const authorization = await atlas.signAuthorization({
      contractAddress: SOLVER,
      chainId: sepolia.id,
      nonce: txNonce + offset,
    });
    try {
      await client.estimateGas({
        account: atlas,
        to: SETTLEMENT,
        data: encoded.calldata,
        authorizationList: [authorization],
        nonce: txNonce,
      });
      chosen = { authorization, nonce: txNonce };
      break;
    } catch (error) {
      lastReason = explain(error, secrets);
    }
  }
  if (!chosen) {
    note("fill", `Fill simulation reverted: ${lastReason}`);
    return;
  }

  const filled = await send(
    client,
    atlas,
    {
      to: SETTLEMENT,
      data: encoded.calldata,
      authorizationList: [chosen.authorization],
      nonce: chosen.nonce,
    },
    secrets,
  );
  await clearDelegation(client, atlas, secrets, note);
  if (!filled.ok || !filled.hash) {
    note("fill", `Fill reverted: ${filled.reason}`);
    return;
  }
  steps.fill.status = "DONE";
  note("fill", `Fill: ${filled.hash}`);
  note(
    "fill",
    "msg.sender is the atlas solver. The same transaction delegates that account to UniswapSolver so settlement's callback runs the solver swap.",
  );
}

async function clearDelegation(
  client: PublicClient,
  atlas: Account,
  secrets: string[],
  note: (step: StepName, line: string) => void,
): Promise<void> {
  const code = await client.getBytecode({ address: atlas.address });
  if (!code || code === "0x") return;
  const txNonce = await client.getTransactionCount({ address: atlas.address, blockTag: "pending" });
  const authorization = await atlas.signAuthorization({
    contractAddress: zeroAddress,
    chainId: sepolia.id,
    nonce: txNonce + 1,
  });
  const cleared = await send(
    client,
    atlas,
    {
      to: atlas.address,
      data: "0x",
      authorizationList: [authorization],
      nonce: txNonce,
    },
    secrets,
  );
  note(
    "fill",
    cleared.ok && cleared.hash
      ? `Cleared the temporary solver delegation: ${cleared.hash}`
      : `Clearing the solver delegation reverted: ${cleared.reason}`,
  );
}

await main();
