import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRpcPool } from "../packages/solver-sdk/src/rpc-pool.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deploymentPath = path.join(root, "deployments/sepolia.json");
const schemaPath = path.join(root, "specs/deployments.schema.json");

const ENS_ADDRESS_KEYS = [
  "ethRegistrar",
  "ethRegistry",
  "rootRegistry",
  "userRegistryImpl",
  "verifiableFactory",
  "permissionedResolverImpl",
  "universalResolverV2",
  "universalResolverProxy",
  "solversRegistry",
] as const;

type Only = "venue" | "ens" | "all";

interface JsonSchema {
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  type?: string;
  enum?: unknown[];
  pattern?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  items?: JsonSchema;
  minimum?: number;
}

interface Pool {
  currency0: string;
  currency1: string;
}

interface SolverRow {
  address: string;
}

interface Deployment {
  tokens: { tWETH: string; tUSDC: string };
  hook: { address: string };
  pools: { A: Pool; B: Pool };
  settlement: string;
  registry: string;
  names: string;
  uniswapSolvers: string[];
  ens: Record<string, string>;
  solvers: SolverRow[];
  arkivWriterAddresses: string[];
}

interface Target {
  name: string;
  address: string;
}

interface VerifyOptions {
  only: Only;
  deployment: unknown;
  schema: JsonSchema;
  getCode: (address: string) => Promise<string>;
  secrets: readonly string[];
}

interface VerifyResult {
  exitCode: number;
  output: string;
}

const SECRET_NAME = /PRIVATE_KEY|SECRET|MNEMONIC|API_KEY|KEYS_JSON|ACCESS_KEY/i;

function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length < 8) continue;
    out = out.split(secret).join("[redacted]");
  }
  return out;
}

export function secretValues(env: Readonly<Record<string, string | undefined>>): string[] {
  const secrets: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (!value) continue;
    if (SECRET_NAME.test(name) || /^0x[a-fA-F0-9]{64}$/.test(value)) secrets.push(value);
  }
  return secrets;
}

function readEnvFile(file: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return {};
  }
  const values: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const body = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eq = body.indexOf("=");
    if (eq < 0) continue;
    const name = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (name) values[name] = value;
  }
  return values;
}

function mergedEnv(): Record<string, string | undefined> {
  return { ...readEnvFile(path.join(root, "secrets/.env.local")), ...process.env };
}

function rpcUrls(env: Readonly<Record<string, string | undefined>>): string[] {
  const urls: string[] = [];
  for (const name of ["SEPOLIA_RPC_URL", "SEPOLIA_RPC_URL_2", "SEPOLIA_RPC_URL_3"]) {
    const value = env[name];
    if (value) urls.push(value);
  }
  const many = env.NEXT_PUBLIC_SEPOLIA_RPCS;
  if (many) {
    for (const part of many.split(/[\s,]+/)) {
      if (part) urls.push(part);
    }
  }
  return [...new Set(urls)];
}

function resolveRef(rootSchema: JsonSchema, ref: string): JsonSchema | null {
  if (!ref.startsWith("#/$defs/")) return null;
  return rootSchema.$defs?.[ref.slice("#/$defs/".length)] ?? null;
}

function validate(data: unknown, schema: JsonSchema, rootSchema: JsonSchema, at: string): string[] {
  const resolved = schema.$ref ? resolveRef(rootSchema, schema.$ref) : schema;
  if (!resolved) return [`${at}: unresolved $ref`];
  const errors: string[] = [];
  if (resolved.type === "object") {
    if (data === null || typeof data !== "object" || Array.isArray(data)) return [`${at}: expected object`];
    const record = data as Record<string, unknown>;
    for (const key of resolved.required ?? []) {
      if (!(key in record)) errors.push(`${at}: missing ${key}`);
    }
    const properties = resolved.properties ?? {};
    for (const key of Object.keys(record)) {
      const child = properties[key];
      if (child) errors.push(...validate(record[key], child, rootSchema, `${at}.${key}`));
      else if (resolved.additionalProperties === false) errors.push(`${at}: unexpected ${key}`);
    }
    return errors;
  }
  if (resolved.type === "array") {
    if (!Array.isArray(data)) return [`${at}: expected array`];
    if (resolved.items) {
      data.forEach((item, index) => {
        errors.push(...validate(item, resolved.items as JsonSchema, rootSchema, `${at}[${index}]`));
      });
    }
    return errors;
  }
  if (resolved.type === "string") {
    if (typeof data !== "string") return [`${at}: expected string`];
    if (resolved.pattern && !new RegExp(resolved.pattern).test(data)) errors.push(`${at}: pattern mismatch`);
  } else if (resolved.type === "integer") {
    if (typeof data !== "number" || !Number.isInteger(data)) return [`${at}: expected integer`];
    if (resolved.minimum !== undefined && data < resolved.minimum) errors.push(`${at}: below minimum`);
  } else if (resolved.type) {
    return [`${at}: unsupported type ${resolved.type}`];
  }
  if (resolved.enum && !resolved.enum.some((item) => item === data)) errors.push(`${at}: not in enum`);
  return errors;
}

function asDeployment(data: unknown): Deployment {
  return data as Deployment;
}

function targetsFor(deployment: Deployment, only: Only): Target[] {
  const targets: Target[] = [];
  const add = (name: string, address: string | undefined) => {
    if (typeof address === "string") targets.push({ name, address });
  };
  if (only === "venue" || only === "all") {
    add("venue tokens.tWETH", deployment.tokens.tWETH);
    add("venue tokens.tUSDC", deployment.tokens.tUSDC);
    add("venue hook", deployment.hook.address);
    add("venue pools.A.currency0", deployment.pools.A.currency0);
    add("venue pools.A.currency1", deployment.pools.A.currency1);
    add("venue pools.B.currency0", deployment.pools.B.currency0);
    add("venue pools.B.currency1", deployment.pools.B.currency1);
    add("venue settlement", deployment.settlement);
    add("venue registry", deployment.registry);
    add("venue names", deployment.names);
    deployment.uniswapSolvers.forEach((address, index) => add(`venue uniswapSolvers[${index}]`, address));
  }
  if (only === "ens" || only === "all") {
    for (const key of ENS_ADDRESS_KEYS) add(`ens ${key}`, deployment.ens[key]);
  }
  if (only === "all") {
    deployment.solvers.forEach((solver, index) => add(`solver[${index}]`, solver.address));
    deployment.arkivWriterAddresses.forEach((address, index) => add(`arkivWriter[${index}]`, address));
  }
  return targets;
}

function codeBytes(code: string): number | null {
  const trimmed = code.trim();
  if (!/^0x[0-9a-fA-F]*$/.test(trimmed) || (trimmed.length - 2) % 2 !== 0) return null;
  return (trimmed.length - 2) / 2;
}

function isEmptyCode(code: string): boolean {
  const body = code.trim().replace(/^0x/i, "");
  return body.length === 0 || /^0+$/.test(body);
}

export async function verifyDeployments(options: VerifyOptions): Promise<VerifyResult> {
  const errors = validate(options.deployment, options.schema, options.schema, "deployment");
  if (errors.length > 0) {
    return { exitCode: 1, output: redact(`schema invalid\n${errors.join("\n")}\n`, options.secrets) };
  }
  const targets = targetsFor(asDeployment(options.deployment), options.only);
  const lines = ["name | address | bytes | status"];
  let failed = false;
  const cache = new Map<string, string | Error>();
  for (const target of targets) {
    const key = target.address.toLowerCase();
    let cached = cache.get(key);
    if (!cached) {
      try {
        cached = await options.getCode(target.address);
      } catch (error) {
        cached = error instanceof Error ? error : new Error("eth_getCode failed");
      }
      cache.set(key, cached);
    }
    if (cached instanceof Error) {
      failed = true;
      lines.push(`${target.name} | ${target.address} | - | FAIL ${cached.message}`);
      continue;
    }
    const bytes = codeBytes(cached);
    if (bytes === null || isEmptyCode(cached)) {
      failed = true;
      lines.push(`${target.name} | ${target.address} | ${bytes ?? "-"} | EMPTY`);
      continue;
    }
    lines.push(`${target.name} | ${target.address} | ${bytes} | ok`);
  }
  return {
    exitCode: failed ? 1 : 0,
    output: redact(`${lines.join("\n")}\n`, options.secrets),
  };
}

function loadSchema(): JsonSchema {
  return JSON.parse(readFileSync(schemaPath, "utf8")) as JsonSchema;
}

function sampleDeployment(): Record<string, unknown> {
  const A = "0x1111111111111111111111111111111111111111";
  const B = "0x2222222222222222222222222222222222222222";
  const C = "0x3333333333333333333333333333333333333333";
  const D = "0x4444444444444444444444444444444444444444";
  const E = "0x5555555555555555555555555555555555555555";
  const F = "0x6666666666666666666666666666666666666666";
  const G = "0x7777777777777777777777777777777777777777";
  const H = "0x8888888888888888888888888888888888888888";
  const I = "0x9999999999999999999999999999999999999999";
  const J = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const K = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const pool = (fee: number, tickSpacing: number, poolId: string) => ({
    poolId,
    fee,
    tickSpacing,
    currency0: A,
    currency1: B,
  });
  return {
    chainId: 11155111,
    tokens: { tWETH: A, tUSDC: B },
    hook: { address: C, flagBitsHex: "0x1080", salt: `0x${"22".repeat(32)}` },
    pools: {
      A: pool(500, 10, `0x${"11".repeat(32)}`),
      B: pool(3000, 60, `0x${"33".repeat(32)}`),
    },
    settlement: D,
    registry: E,
    names: F,
    uniswapSolvers: [G],
    ens: {
      ethRegistrar: H,
      ethRegistry: H,
      rootRegistry: H,
      userRegistryImpl: H,
      verifiableFactory: H,
      permissionedResolverImpl: H,
      universalResolverV2: H,
      universalResolverProxy: H,
      parentLabel: "rival",
      solversRegistry: I,
    },
    solvers: [{ label: "atlas", address: J, strategy: "sprint" }],
    arkivWriterAddresses: [K],
    runnerUrl: "https://runner.example",
    commit: "abcdef0",
  };
}

async function selfTest(): Promise<void> {
  const schema = loadSchema();
  const deployment = sampleDeployment();
  const privateKey = `0x${"deadbeef".repeat(8)}`;
  const secrets = secretValues({ OPERATOR_PRIVATE_KEY: privateKey, SEPOLIA_RPC_URL: "https://rpc.example" });
  const problems: string[] = [];
  if (!secrets.includes(privateKey)) problems.push("private key was not detected as a secret");

  const run = (getCode: (address: string) => Promise<string>) =>
    verifyDeployments({ only: "all", deployment, schema, getCode, secrets });

  const empty = await run(async () => "0x");
  const filled = await run(async () => "0x60016000f3");
  const echoed = await run(async () => {
    throw new Error(`provider echoed ${privateKey}`);
  });
  if (empty.exitCode !== 1) problems.push(`empty code exit ${empty.exitCode}, expected 1`);
  if (!empty.output.includes("EMPTY")) problems.push("empty code did not print EMPTY");
  if (filled.exitCode !== 0) problems.push(`non-empty code exit ${filled.exitCode}, expected 0`);
  if (!filled.output.includes("| ok")) problems.push("non-empty code did not print ok");
  if (echoed.exitCode === 0) problems.push("echoed private key lookup should fail");
  for (const output of [empty.output, filled.output, echoed.output]) {
    if (output.includes(privateKey)) problems.push("private key value was printed");
  }
  if (!echoed.output.includes("[redacted]")) problems.push("private key echo was not redacted");
  if (problems.length > 0) throw new Error(problems.join("\n"));
  console.log("verify-deployments self-test ok");
}

function parseOnly(argv: readonly string[]): { only: Only; selfTest: boolean } {
  let only: Only = "all";
  let self = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--self-test") {
      self = true;
      continue;
    }
    if (arg === "--only" || arg?.startsWith("--only=")) {
      const value = arg === "--only" ? argv[i + 1] : arg.slice("--only=".length);
      if (arg === "--only") i += 1;
      if (value !== "venue" && value !== "ens" && value !== "all") {
        throw new Error("--only expects venue|ens|all");
      }
      only = value;
      continue;
    }
    throw new Error(`unknown argument ${arg ?? ""}`);
  }
  return { only, selfTest: self };
}

async function main(): Promise<number> {
  const args = parseOnly(process.argv.slice(2));
  if (args.selfTest) {
    await selfTest();
    return 0;
  }
  const env = mergedEnv();
  const secrets = secretValues(env);
  let text: string;
  try {
    text = readFileSync(deploymentPath, "utf8");
  } catch {
    console.error(redact("deployments/sepolia.json is missing", secrets));
    return 1;
  }
  let deployment: unknown;
  try {
    deployment = JSON.parse(text) as unknown;
  } catch {
    console.error(redact("deployments/sepolia.json is not valid JSON", secrets));
    return 1;
  }
  const urls = rpcUrls(env);
  if (urls.length === 0) {
    console.error(redact("no Sepolia RPC url is set", secrets));
    return 1;
  }
  const pool = createRpcPool(urls, { timeoutMs: 10_000, cooldownMs: 1_000 });
  const { request } = pool({});
  const result = await verifyDeployments({
    only: args.only,
    deployment,
    schema: loadSchema(),
    secrets,
    async getCode(address) {
      const code = await request({
        method: "eth_getCode",
        params: [address as `0x${string}`, "latest"],
      });
      if (typeof code !== "string") throw new Error("eth_getCode result was not a string");
      return code;
    },
  });
  process.stdout.write(result.output);
  return result.exitCode;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      const secrets = secretValues(mergedEnv());
      const message = error instanceof Error ? error.message : "verify-deployments failed";
      console.error(redact(message, secrets));
      process.exit(1);
    });
}
