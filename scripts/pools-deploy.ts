import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZERO = "0x0000000000000000000000000000000000000000";
const STATE_VIEW = "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c";
const QUOTER = "0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244";
const QUOTE_SIG =
  "quoteExactInputSingle(((address,address,uint24,int24,address),bool,uint128,bytes))(uint256,uint256)";

type Venue = {
  tweth: string;
  tusdc: string;
  hook: string;
  salt: string;
  poolA: string;
  poolB: string;
  currency0: string;
  currency1: string;
  sqrt: bigint;
  stateView: string;
  quoter: string;
};

function loadSecrets(): { rpc: string; key: string } {
  const text = readFileSync(path.join(root, "secrets/.env.local"), "utf8");
  const values = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const body = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eq = body.indexOf("=");
    if (eq < 0) continue;
    const name = body.slice(0, eq).trim();
    const value = body.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    values.set(name, value);
  }
  const rpc = values.get("SEPOLIA_RPC_URL");
  const key = values.get("OPERATOR_PRIVATE_KEY");
  if (!rpc || !key) throw new Error("SEPOLIA_RPC_URL or OPERATOR_PRIVATE_KEY is missing");
  return { rpc, key };
}

function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length > 0) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/https?:\/\/\S+/g, "[redacted-url]");
}

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd = root,
): { status: number; output: string } {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return { status: result.status ?? 1, output };
}

function parseVenue(output: string): Venue {
  const fields = new Map<string, string>();
  for (const line of output.split("\n")) {
    const match = line.match(/VENUE_([A-Z0-9_]+) (0x[0-9a-fA-F]+|\d+)/);
    const name = match?.[1];
    const value = match?.[2];
    if (name && value) fields.set(name, value);
  }
  const need = (name: string): string => {
    const value = fields.get(name);
    if (!value) throw new Error(`missing ${name} in forge output`);
    return value;
  };
  const address = (name: string): string => {
    const value = need(name);
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`bad address ${name}`);
    return value;
  };
  const bytes32 = (name: string): string => {
    const value = need(name).toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(value)) throw new Error(`bad bytes32 ${name}`);
    return value;
  };
  return {
    tweth: address("TWETH"),
    tusdc: address("TUSDC"),
    hook: address("HOOK"),
    salt: bytes32("SALT"),
    poolA: bytes32("POOL_A"),
    poolB: bytes32("POOL_B"),
    currency0: address("CURRENCY0"),
    currency1: address("CURRENCY1"),
    sqrt: BigInt(need("SQRT")),
    stateView: address("STATEVIEW"),
    quoter: address("QUOTER"),
  };
}

function cast(args: string[], env: NodeJS.ProcessEnv, secrets: string[]): string {
  const result = run("cast", args, env);
  if (result.status !== 0) {
    throw new Error(redact(result.output, secrets).slice(-4000));
  }
  return result.output.trim();
}

function parseWords(output: string): string[] {
  const trimmed = output.trim();
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("cast json was not an array");
    return parsed.map((item) => String(item));
  }
  return trimmed
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0] ?? "")
    .filter((word) => word.length > 0);
}

function readSlot0(poolId: string, env: NodeJS.ProcessEnv, secrets: string[], rpc: string): {
  sqrt: bigint;
  tick: bigint;
  lpFee: bigint;
} {
  const output = cast(
    ["call", STATE_VIEW, "getSlot0(bytes32)(uint160,int24,uint24,uint24)", poolId, "--rpc-url", rpc],
    env,
    secrets,
  );
  const words = parseWords(output);
  const sqrt = words[0];
  const tick = words[1];
  const lpFee = words[3];
  if (!sqrt || !tick || !lpFee) throw new Error(`slot0 parse failed: ${output}`);
  return { sqrt: BigInt(sqrt), tick: BigInt(tick), lpFee: BigInt(lpFee) };
}

function quote(
  venue: Venue,
  fee: number,
  tickSpacing: number,
  hooks: string,
  zeroForOne: boolean,
  amount: bigint,
  env: NodeJS.ProcessEnv,
  secrets: string[],
  rpc: string,
): bigint {
  const args = `((${venue.currency0},${venue.currency1},${fee},${tickSpacing},${hooks}),${zeroForOne},${amount.toString()},0x)`;
  const output = cast(["call", QUOTER, QUOTE_SIG, args, "--rpc-url", rpc], env, secrets);
  const amountOut = parseWords(output)[0];
  if (!amountOut) throw new Error(`quote parse failed: ${output}`);
  return BigInt(amountOut);
}

function spotOut(sqrt: bigint, amountIn: bigint, zeroForOne: boolean, feePips: number): bigint {
  const ratio = sqrt * sqrt;
  const raw = zeroForOne ? (ratio * amountIn) / (1n << 192n) : ((1n << 192n) * amountIn) / ratio;
  return (raw * BigInt(1_000_000 - feePips)) / 1_000_000n;
}

function withinFivePercent(got: bigint, expected: bigint): boolean {
  if (expected === 0n || got === 0n) return false;
  const diff = got > expected ? got - expected : expected - got;
  return diff * 100n <= expected * 5n;
}

function writeDeployment(venue: Venue): void {
  const head = run("git", ["rev-parse", "HEAD"], process.env);
  const commit = head.output.trim().split("\n").at(-1) ?? "";
  if (!/^[a-f0-9]{7,40}$/.test(commit)) throw new Error("could not read HEAD");
  const ens = {
    ethRegistrar: ZERO,
    ethRegistry: ZERO,
    rootRegistry: ZERO,
    userRegistryImpl: ZERO,
    verifiableFactory: ZERO,
    permissionedResolverImpl: ZERO,
    universalResolverV2: ZERO,
    universalResolverProxy: ZERO,
    parentLabel: "rival",
    solversRegistry: ZERO,
  };
  const body = {
    chainId: 11155111,
    tokens: { tWETH: venue.tweth, tUSDC: venue.tusdc },
    hook: { address: venue.hook, flagBitsHex: "0x1080", salt: venue.salt },
    pools: {
      A: {
        poolId: venue.poolA,
        fee: 500,
        tickSpacing: 10,
        currency0: venue.currency0,
        currency1: venue.currency1,
      },
      B: {
        poolId: venue.poolB,
        fee: 3000,
        tickSpacing: 60,
        currency0: venue.currency0,
        currency1: venue.currency1,
      },
    },
    settlement: ZERO,
    registry: ZERO,
    names: ZERO,
    uniswapSolvers: [],
    ens,
    solvers: [],
    arkivWriterAddresses: [],
    runnerUrl: "https://runner.local",
    commit,
  };
  const file = path.join(root, "deployments/sepolia.json");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
}

function appendDoc(venue: Venue, deployedLens: boolean): void {
  const file = path.join(root, "docs/oracle.md");
  const current = readFileSync(file, "utf8");
  if (current.includes("## Sepolia venue")) return;
  const lens = deployedLens
    ? `\nStateView \`${venue.stateView}\` and V4Quoter \`${venue.quoter}\` were deployed with this venue because no code was found at the pinned Sepolia addresses.\n`
    : "";
  const section = `
## Sepolia venue

Pool A \`${venue.poolA}\`. Pool B \`${venue.poolB}\`. Hook \`${venue.hook}\`. Flag mask \`0x1080\`.
${lens}
\`deployments/sepolia.json\` leaves settlement, registry, names, and the ENS addresses (\`ethRegistrar\`, \`ethRegistry\`, \`rootRegistry\`, \`userRegistryImpl\`, \`verifiableFactory\`, \`permissionedResolverImpl\`, \`universalResolverV2\`, \`universalResolverProxy\`, \`solversRegistry\`) at the zero address. \`uniswapSolvers\`, \`solvers\`, and \`arkivWriterAddresses\` are empty. Those values are placeholders. They were not deployed.
`;
  writeFileSync(file, `${current.trimEnd()}\n${section}`);
}

function main(): number {
  const simulate = process.argv.includes("--simulate");
  const broadcast = process.argv.includes("--broadcast");
  if (simulate === broadcast) {
    console.error("pass exactly one of --simulate or --broadcast");
    return 1;
  }
  const { rpc, key } = loadSecrets();
  const env = { ...process.env, SEPOLIA_RPC_URL: rpc };
  const secrets = [rpc, key];
  const forgeArgs = [
    "script",
    "script/DeployVenue.s.sol:DeployVenue",
    "--rpc-url",
    "sepolia",
    "--private-key",
    key,
    "--always-use-create-2-factory",
    "--non-interactive",
    "--gas-estimate-multiplier",
    "800",
    "-vv",
  ];
  if (broadcast) forgeArgs.push("--broadcast", "--slow");
  const forge = run("forge", forgeArgs, env, path.join(root, "contracts"));
  const safeLog = redact(forge.output, secrets);
  const venueLines = safeLog
    .split("\n")
    .filter((line) => line.includes("VENUE_"))
    .join("\n");
  if (forge.status !== 0) {
    const interesting = safeLog
      .split("\n")
      .filter((line) => /Error|Revert|revert|FAIL|Panic|Hook|Depth|Range|Slot0|VENUE_/.test(line))
      .join("\n");
    console.error((interesting || safeLog).slice(-8000));
    return forge.status;
  }
  const venue = parseVenue(safeLog);
  console.log(venueLines);
  if ((BigInt(venue.hook) & 0x3fffn) !== 0x1080n) {
    console.error("hook flag mask is not 0x1080");
    return 1;
  }
  if (!broadcast) {
    console.log("simulation ok");
    return 0;
  }

  writeDeployment(venue);
  const ajv = run(
    "pnpm",
    ["exec", "ajv", "validate", "-s", "specs/deployments.schema.json", "-d", "deployments/sepolia.json", "--spec=draft7"],
    process.env,
  );
  if (ajv.status !== 0) {
    console.error(redact(ajv.output, secrets));
    return ajv.status;
  }
  const deployedLens =
    venue.stateView.toLowerCase() !== STATE_VIEW.toLowerCase() || venue.quoter.toLowerCase() !== QUOTER.toLowerCase();
  appendDoc(venue, deployedLens);

  const slotA = readSlot0(venue.poolA, env, secrets, rpc);
  const slotB = readSlot0(venue.poolB, env, secrets, rpc);
  const slotOk = slotA.sqrt === venue.sqrt && slotA.lpFee === 500n && slotB.sqrt === venue.sqrt && slotB.lpFee === 3000n;
  console.log(`slot0 A sqrt ${slotA.sqrt} tick ${slotA.tick} lpFee ${slotA.lpFee}`);
  console.log(`slot0 B sqrt ${slotB.sqrt} tick ${slotB.tick} lpFee ${slotB.lpFee}`);

  const weth = BigInt(venue.tweth);
  const usdc = BigInt(venue.tusdc);
  const wethToUsdc = weth < usdc;
  const oneWeth = 10n ** 18n;
  const threeThousandUsdc = 3000n * 10n ** 6n;
  const quotePool = (fee: number, spacing: number, hooks: string, label: string): boolean => {
    const sellWeth = quote(venue, fee, spacing, hooks, wethToUsdc, oneWeth, env, secrets, rpc);
    const sellUsdc = quote(venue, fee, spacing, hooks, !wethToUsdc, threeThousandUsdc, env, secrets, rpc);
    const sellWethOk = withinFivePercent(sellWeth, spotOut(venue.sqrt, oneWeth, wethToUsdc, fee));
    const sellUsdcOk = withinFivePercent(sellUsdc, spotOut(venue.sqrt, threeThousandUsdc, !wethToUsdc, fee));
    console.log(`${label} tWETH->tUSDC ${sellWeth} ok ${sellWethOk}`);
    console.log(`${label} tUSDC->tWETH ${sellUsdc} ok ${sellUsdcOk}`);
    return sellWethOk && sellUsdcOk;
  };
  const quotesOk = quotePool(500, 10, venue.hook, "pool A") && quotePool(3000, 60, ZERO, "pool B");
  console.log(`schema ok; slot0 ${slotOk}; quotes ${quotesOk}`);
  return slotOk && quotesOk ? 0 : 2;
}

try {
  process.exit(main());
} catch (error) {
  const message = error instanceof Error ? error.message : "pools-deploy failed";
  console.error(message.replace(/https?:\/\/\S+/g, "[redacted-url]"));
  process.exit(1);
}
