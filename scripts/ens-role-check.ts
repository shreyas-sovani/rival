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

export function roleCheck(argv: string[]): number {
  const expectPath = flagValue(argv, "--expect");
  if (!expectPath) {
    console.error("usage: tsx scripts/ens-role-check.ts --expect <path> [--roles <path>]");
    return 1;
  }
  loadTable(expectPath);
  const rolesPath = flagValue(argv, "--roles");
  if (!rolesPath) {
    console.log(BLOCKED);
    return 2;
  }
  const expected = loadTable(expectPath);
  const actual = loadTable(rolesPath);
  const diffs = diffRoles(expected, actual);
  console.log(formatTable(diffs));
  const ok = diffs.every((diff) => diff.status === "OK");
  console.log(ok ? "result: ok" : "result: mismatch");
  return ok ? 0 : 1;
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
