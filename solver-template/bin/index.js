#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STRATEGIES = ["sprint", "patient", "arb", "inventory", "house"];

const helpText = `rival-solver

Usage:
  node bin/index.js --help
  node bin/index.js init --label <label> [--rpc <url>] [--key-env <name>]
  node bin/index.js dev --label <label> [--rpc <url>] [--key-env <name>] [--strategy <id>]

init calls @rival/solver-sdk initSolver.
dev calls @rival/solver-sdk runSolver and blocks until SIGINT or SIGTERM.

--label is the solver name.
--rpc is an HTTP RPC URL, or SEPOLIA_RPC_URL when omitted.
--key-env names the private key variable (default SOLVER_PRIVATE_KEY).
--strategy is sprint, patient, arb, inventory, or house.
`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadEnv() {
  const files = [path.join(root, ".env"), path.join(process.cwd(), ".env")];
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined) process.env[parsed.key] = parsed.value;
    }
  }
}

function parseEnvLine(line) {
  let trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return undefined;
  if (trimmed.startsWith("export ")) trimmed = trimmed.slice("export ".length).trim();
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return undefined;
  const key = trimmed.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return undefined;
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function takeFlags(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--label" || arg === "--rpc" || arg === "--key-env" || arg === "--strategy") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) fail(`${arg} requires a value`);
      flags[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) fail(`unknown flag ${arg}`);
    fail(`unexpected argument ${arg}`);
  }
  return flags;
}

function requireKey(envName) {
  const name = envName?.trim() || "SOLVER_PRIVATE_KEY";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) fail("--key-env must name an environment variable");
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") fail(`missing ${name}`);
  const value = raw.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(value)) fail(`${name} must be 0x-prefixed hex`);
  return value;
}

function requireRpc(flag) {
  const rpc = flag?.trim() || process.env.SEPOLIA_RPC_URL?.trim() || "";
  if (!rpc) fail("missing rpc: pass --rpc or set SEPOLIA_RPC_URL");
  return rpc;
}

function oneOf(flag, value) {
  if (value === undefined) return undefined;
  if (STRATEGIES.includes(value)) return value;
  fail(`${flag} must be one of: ${STRATEGIES.join(", ")}`);
}

async function loadSdk() {
  try {
    return await import("@rival/solver-sdk");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const strip = code === "ERR_UNKNOWN_FILE_EXTENSION" || error instanceof SyntaxError;
    if (!strip || process.env.RIVAL_SOLVER_STRIP === "1") throw error;
    const child = spawnSync(
      process.execPath,
      ["--experimental-strip-types", process.argv[1], ...process.argv.slice(2)],
      { stdio: "inherit", env: { ...process.env, RIVAL_SOLVER_STRIP: "1" } },
    );
    process.exit(child.status === null ? 1 : child.status);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    process.stdout.write(helpText);
    process.exit(0);
  }
  const command = args[0];
  if (command !== "init" && command !== "dev") fail("command must be init or dev");
  const flags = takeFlags(args.slice(1));
  const label = flags.label?.trim() ?? "";
  if (!label) fail("--label is required");
  loadEnv();
  const key = requireKey(flags["key-env"]);
  const rpc = requireRpc(flags.rpc);
  const sdk = await loadSdk();
  if (command === "init") {
    if (typeof sdk.initSolver !== "function") fail("initSolver is not exported");
    const result = await sdk.initSolver({ label, key, rpc });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const strategy = oneOf("--strategy", flags.strategy);
  if (typeof sdk.runSolver !== "function") fail("runSolver is not exported");
  await sdk.runSolver({ label, key, rpc, ...(strategy ? { strategy } : {}) });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
