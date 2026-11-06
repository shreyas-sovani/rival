import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_FILES = ["secrets/.env.local", ".env.local", ".env"] as const;
const SOLVER_SDK: string = "@rival/solver-sdk";

export class NotImplemented extends Error {
  constructor() {
    super("NOT_IMPLEMENTED(M-020)");
    this.name = "NotImplemented";
  }
}

/** Load local env files without overriding variables already set in the process. */
export function loadEnv(): void {
  for (const relative of ENV_FILES) {
    const file = path.join(root, relative);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined) process.env[parsed.key] = parsed.value;
    }
  }
}

export function oneOf<const T extends readonly string[]>(
  flag: string,
  value: string | undefined,
  allowed: T,
): T[number] | undefined {
  if (value === undefined) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T[number];
  console.error(`${flag} must be one of: ${allowed.join(", ")}`);
  process.exit(1);
}

export function integerFlag(flag: string, value: string | undefined): bigint | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    console.error(`${flag} must be an integer`);
    process.exit(1);
  }
  return BigInt(trimmed);
}

/** `--key-env` names the variable. When omitted, use the solver-template key. */
export function requireKey(envName: string | undefined): `0x${string}` {
  const name = envName?.trim() || "SOLVER_PRIVATE_KEY";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    console.error("--key-env must name an environment variable");
    process.exit(1);
  }
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    console.error(`missing ${name}`);
    process.exit(1);
  }
  const value = raw.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(value)) {
    console.error(`${name} must be 0x-prefixed hex`);
    process.exit(1);
  }
  return value as `0x${string}`;
}

export function requireRpc(flag: string | undefined): string {
  const rpc = flag?.trim() || process.env.SEPOLIA_RPC_URL?.trim() || "";
  if (!rpc) {
    console.error("missing rpc: pass --rpc or set SEPOLIA_RPC_URL");
    process.exit(1);
  }
  return rpc;
}

/** `verifyFill` takes only a tx hash. `--rpc` is applied to the process env. */
export function applyRpc(flag: string | undefined): void {
  if (flag === undefined) return;
  const rpc = flag.trim();
  if (!rpc) {
    console.error("--rpc requires a URL");
    process.exit(1);
  }
  process.env.SEPOLIA_RPC_URL = rpc;
}

/**
 * Dynamic-import `@rival/solver-sdk` and return one export.
 * A missing module, a throwing export, or a non-function is M-020's job.
 */
export async function sdkExport(name: string): Promise<(...args: unknown[]) => Promise<unknown>> {
  let loaded: Record<string, unknown>;
  try {
    loaded = (await import(SOLVER_SDK)) as Record<string, unknown>;
  } catch {
    throw new NotImplemented();
  }
  let exported: unknown;
  try {
    exported = loaded[name];
  } catch {
    throw new NotImplemented();
  }
  if (typeof exported !== "function") throw new NotImplemented();
  return exported as (...args: unknown[]) => Promise<unknown>;
}

export function printResult(value: unknown): void {
  if (Array.isArray(value)) {
    if (value.every(isRecord)) printTable(value);
    else console.log(formatCell(value));
    return;
  }
  if (!isRecord(value)) {
    console.log(formatCell(value));
    return;
  }

  const nested: { key: string; rows: Record<string, unknown>[] }[] = [];
  const flat: Record<string, unknown> = {};
  for (const [key, cell] of Object.entries(value)) {
    if (Array.isArray(cell) && cell.every(isRecord)) {
      nested.push({ key, rows: cell });
      flat[key] = cell.length === 1 ? "[1 row]" : `[${cell.length} rows]`;
    } else {
      flat[key] = cell;
    }
  }
  printTable([flat]);
  for (const table of nested) {
    console.log("");
    console.log(table.key);
    printTable(table.rows);
  }
}

export function report(error: unknown): never {
  if (error instanceof NotImplemented) {
    console.error(error.message);
    process.exit(3);
  }
  console.error(redact(errorText(error), secretValues()));
  process.exit(1);
}

function parseEnvLine(line: string): { key: string; value: string } | undefined {
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

function printTable(rows: readonly Record<string, unknown>[]): void {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  if (columns.length === 0) {
    console.log("(no rows)");
    return;
  }
  const rendered = rows.map((row) => columns.map((column) => formatCell(row[column])));
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...rendered.map((row) => row[index]?.length ?? 0)),
  );
  const format = (cells: readonly string[]) =>
    cells
      .map((cell, index) => cell.padEnd(widths[index] ?? cell.length))
      .join("  ")
      .trimEnd();
  console.log(format(columns));
  console.log(
    widths
      .map((width) => "-".repeat(width))
      .join("  ")
      .trimEnd(),
  );
  for (const row of rendered) console.log(format(row));
}

function formatCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.replaceAll("\n", " ");
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return (
      JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)) ??
      ""
    );
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

function secretValues(): string[] {
  const values: string[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || value.length < 8) continue;
    if (/KEY|SECRET|TOKEN|PASSWORD/i.test(name) || /^0x[0-9a-fA-F]{16,}$/.test(value)) {
      values.push(value);
    }
  }
  return values;
}

function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length < 8) continue;
    out = out.split(secret).join("[redacted]");
  }
  return out;
}
