import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type RoleGrant = {
  role: string;
  holder: string;
  resource: string;
};

export type RoleStatus = "OK" | "MISSING" | "EXTRA";

export type RoleDiff = {
  status: RoleStatus;
  grant: RoleGrant;
};

const BLOCKED = "BLOCKED: live role read waits for a deployed solvers registry";
const ZERO = "0x0000000000000000000000000000000000000000";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NAMED_ROLES: Array<[string, bigint]> = [
  ["ROLE_REGISTRAR", 1n << 0n],
  ["ROLE_REGISTER_RESERVED", 1n << 4n],
  ["ROLE_SET_PARENT", 1n << 8n],
  ["ROLE_UNREGISTER", 1n << 12n],
  ["ROLE_RENEW", 1n << 16n],
  ["ROLE_SET_SUBREGISTRY", 1n << 20n],
  ["ROLE_SET_RESOLVER", 1n << 24n],
  ["ROLE_WAS_RESERVED", 1n << 32n],
  ["ROLE_SET_URI", 1n << 36n],
  ["ROLE_CAN_NAME", 1n << 120n],
  ["ROLE_UPGRADE", 1n << 124n],
  ["ROLE_REGISTRAR_ADMIN", 1n << 128n],
  ["ROLE_REGISTER_RESERVED_ADMIN", 1n << 132n],
  ["ROLE_SET_PARENT_ADMIN", 1n << 136n],
  ["ROLE_UNREGISTER_ADMIN", 1n << 140n],
  ["ROLE_RENEW_ADMIN", 1n << 144n],
  ["ROLE_SET_SUBREGISTRY_ADMIN", 1n << 148n],
  ["ROLE_SET_RESOLVER_ADMIN", 1n << 152n],
  ["ROLE_CAN_TRANSFER_ADMIN", (1n << 28n) << 128n],
  ["ROLE_WAS_RESERVED_ADMIN", 1n << 160n],
  ["ROLE_SET_URI_ADMIN", 1n << 164n],
  ["ROLE_CAN_NAME_ADMIN", 1n << 248n],
  ["ROLE_UPGRADE_ADMIN", 1n << 252n],
];

function normalizeHolder(holder: string): string {
  const trimmed = holder.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

export function parseRoleTable(raw: unknown): RoleGrant[] {
  if (!Array.isArray(raw)) throw new Error("role table must be a JSON array");
  return raw.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error(`row ${index} is not an object`);
    const record = row as Record<string, unknown>;
    for (const key of ["role", "holder", "resource"] as const) {
      if (typeof record[key] !== "string" || record[key].trim() === "") {
        throw new Error(`row ${index} ${key} must be a non-empty string`);
      }
    }
    return {
      role: (record.role as string).trim(),
      holder: normalizeHolder(record.holder as string),
      resource: (record.resource as string).trim(),
    };
  });
}

function loadTable(file: string): RoleGrant[] {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new Error(`cannot read ${file}`);
  }
  try {
    return parseRoleTable(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`invalid JSON in ${file}`);
    throw error;
  }
}

function grantKey(grant: RoleGrant): string {
  return `${grant.role}\0${grant.holder}\0${grant.resource}`;
}

export function diffRoles(expected: RoleGrant[], actual: RoleGrant[]): RoleDiff[] {
  const expectedCounts = new Map<string, { grant: RoleGrant; count: number }>();
  const actualCounts = new Map<string, { grant: RoleGrant; count: number }>();
  for (const grant of expected) {
    const key = grantKey(grant);
    const current = expectedCounts.get(key);
    if (current) current.count += 1;
    else expectedCounts.set(key, { grant, count: 1 });
  }
  for (const grant of actual) {
    const key = grantKey(grant);
    const current = actualCounts.get(key);
    if (current) current.count += 1;
    else actualCounts.set(key, { grant, count: 1 });
  }
  const keys = [...new Set([...expectedCounts.keys(), ...actualCounts.keys()])].sort();
  const diffs: RoleDiff[] = [];
  for (const key of keys) {
    const expectedRow = expectedCounts.get(key);
    const actualRow = actualCounts.get(key);
    const expectedCount = expectedRow?.count ?? 0;
    const actualCount = actualRow?.count ?? 0;
    const matched = Math.min(expectedCount, actualCount);
    const grant = (expectedRow ?? actualRow)!.grant;
    for (let i = 0; i < matched; i += 1) diffs.push({ status: "OK", grant });
    for (let i = 0; i < expectedCount - actualCount; i += 1) diffs.push({ status: "MISSING", grant });
    for (let i = 0; i < actualCount - expectedCount; i += 1) {
      diffs.push({ status: "EXTRA", grant: actualRow!.grant });
    }
  }
  return diffs;
}

export function grantsFromBitmap(bitmap: bigint, holder: string): RoleGrant[] {
  const normalized = normalizeHolder(holder);
  const grants: RoleGrant[] = [];
  let rest = bitmap;
  for (const [role, bit] of NAMED_ROLES) {
    if ((rest & bit) === bit) {
      grants.push({ role, holder: normalized, resource: "0" });
      rest &= ~bit;
    }
  }
  for (let bitIndex = 0; bitIndex < 256; bitIndex += 1) {
    const bit = 1n << BigInt(bitIndex);
    if ((rest & bit) !== 0n) grants.push({ role: `BIT_${bitIndex}`, holder: normalized, resource: "0" });
  }
  return grants;
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function solversRegistryFromDeployment(raw: unknown): { registry: string; names: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { ens?: { solversRegistry?: unknown }; names?: unknown };
  const registry = body.ens?.solversRegistry;
  const names = body.names;
  if (!isAddress(registry) || !isAddress(names)) return null;
  if (registry.toLowerCase() === ZERO || names.toLowerCase() === ZERO) return null;
  return { registry, names };
}

function loadRpc(): string {
  let text: string;
  try {
    text = readFileSync(path.join(root, "secrets/.env.local"), "utf8");
  } catch {
    throw new Error("SEPOLIA_RPC_URL is missing");
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const body = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eq = body.indexOf("=");
    if (eq < 0) continue;
    const name = body.slice(0, eq).trim();
    if (name !== "SEPOLIA_RPC_URL") continue;
    const value = body.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!value) break;
    return value;
  }
  throw new Error("SEPOLIA_RPC_URL is missing");
}

function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/https?:\/\/\S+/g, "[redacted-url]");
}

function readRoles(registry: string, names: string): bigint {
  const rpc = loadRpc();
  const result = spawnSync(
    "cast",
    ["call", registry, "roles(uint256,address)(uint256)", "0", names, "--rpc-url", rpc],
    { encoding: "utf8", timeout: 30000 },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if ((result.status ?? 1) !== 0) {
    throw new Error(redact(output, [rpc]).trim().slice(0, 500) || "roles call failed");
  }
  const token = (result.stdout ?? "").trim().split(/\s+/)[0];
  if (!token) throw new Error("roles call returned empty");
  return BigInt(token);
}

function formatTable(diffs: RoleDiff[]): string {
  const cells = [
    ["status", "role", "holder", "resource"],
    ...diffs.map((diff) => [diff.status, diff.grant.role, diff.grant.holder, diff.grant.resource]),
  ];
  const widths = cells[0]!.map((_, column) => Math.max(...cells.map((row) => row[column]!.length)));
  return cells.map((row) => row.map((cell, column) => cell.padEnd(widths[column]!)).join("  ")).join("\n");
}

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a path`);
  return value;
}

function report(expected: RoleGrant[], actual: RoleGrant[]): number {
  const diffs = diffRoles(expected, actual);
  console.log(formatTable(diffs));
  const ok = diffs.every((diff) => diff.status === "OK");
  console.log(ok ? "result: ok" : "result: mismatch");
  return ok ? 0 : 1;
}

export function roleCheck(argv: string[]): number {
  const expectPath = flagValue(argv, "--expect");
  if (!expectPath) {
    console.error("usage: tsx scripts/ens-role-check.ts --expect <path> [--roles <path>] [--deployments <path>]");
    return 1;
  }
  const expected = loadTable(expectPath);
  const rolesPath = flagValue(argv, "--roles");
  if (rolesPath) return report(expected, loadTable(rolesPath));

  const deploymentFile = flagValue(argv, "--deployments") ?? path.join(root, "deployments/sepolia.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(deploymentFile, "utf8")) as unknown;
  } catch {
    console.log(BLOCKED);
    return 2;
  }
  const deployed = solversRegistryFromDeployment(raw);
  if (!deployed) {
    console.log(BLOCKED);
    return 2;
  }
  const names = deployed.names.toLowerCase();
  const liveExpected = expected.map((grant) => (grant.holder === "RivalNames" ? { ...grant, holder: names } : grant));
  const actual = grantsFromBitmap(readRoles(deployed.registry, deployed.names), names);
  return report(liveExpected, actual);
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  }
}

if (invokedDirectly()) {
  try {
    process.exit(roleCheck(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
