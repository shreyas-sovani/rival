import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOut = path.join(root, "apps/web/out");
const allowlistPath = path.join(root, "scripts/egress-allowlist.json");

const URL_ENV = [
  "SEPOLIA_RPC_URL",
  "SEPOLIA_RPC_URL_2",
  "SEPOLIA_RPC_URL_3",
  "NEXT_PUBLIC_SEPOLIA_RPCS",
  "NEXT_PUBLIC_RABDI_RPC",
  "NEXT_PUBLIC_RUNNER_URL",
] as const;

interface Hit {
  host: string;
  file: string;
}

export function hostsInText(text: string): string[] {
  const found = new Set<string>();
  const patterns = [/https?:\/\/[^\s"'<>)]+/gi, /https?:\\\/\\\/[^\s"'<>)]+/gi];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[0].replaceAll("\\/", "/").replace(/[),.;]+$/g, "");
      try {
        const host = new URL(raw).hostname.toLowerCase();
        if (host.includes(".")) found.add(host);
      } catch {
        // Unparsable URL-shaped text is not a host.
      }
    }
  }
  return [...found];
}

export function normalizeHost(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.includes(" ")) return null;
  try {
    const host = trimmed.includes("://") ? new URL(trimmed).hostname : new URL(`https://${trimmed}`).hostname;
    return host.toLowerCase() || null;
  } catch {
    return null;
  }
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

export function scanDirectory(dir: string): Hit[] {
  const hits: Hit[] = [];
  for (const file of walk(dir)) {
    const text = readFileSync(file);
    if (text.includes(0)) continue;
    for (const host of hostsInText(text.toString("utf8"))) {
      hits.push({ host, file });
    }
  }
  return hits;
}

function readAllowlist(file: string): string[] {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { hosts?: unknown };
  if (!Array.isArray(parsed.hosts)) throw new Error("egress allowlist hosts must be an array");
  const hosts: string[] = [];
  for (const entry of parsed.hosts) {
    if (typeof entry !== "string") throw new Error("egress allowlist hosts must be strings");
    const host = normalizeHost(entry);
    if (host) hosts.push(host);
  }
  return hosts;
}

function hostsFromEnv(env: Readonly<Record<string, string | undefined>>): string[] {
  const hosts: string[] = [];
  for (const name of URL_ENV) {
    const value = env[name];
    if (!value) continue;
    for (const part of value.split(/[\s,]+/)) {
      const host = normalizeHost(part);
      if (host) hosts.push(host);
    }
  }
  return hosts;
}

export function auditHits(hits: readonly Hit[], allow: readonly string[]): { exitCode: number; output: string } {
  const allowed = new Set(allow.map((host) => host.toLowerCase()));
  const byHost = new Map<string, string[]>();
  for (const hit of hits) {
    const files = byHost.get(hit.host) ?? [];
    if (!files.includes(hit.file)) files.push(hit.file);
    byHost.set(hit.host, files);
  }
  const lines = ["host | status | files"];
  let denied = 0;
  for (const host of [...byHost.keys()].sort()) {
    const status = allowed.has(host) ? "allow" : "DENY";
    if (status === "DENY") denied += 1;
    lines.push(`${host} | ${status} | ${(byHost.get(host) ?? []).join(", ")}`);
  }
  if (byHost.size === 0) lines.push("(no hosts) | allow |");
  lines.push(denied === 0 ? "PASS" : `FAIL ${denied} disallowed`);
  return { exitCode: denied === 0 ? 0 : 1, output: `${lines.join("\n")}\n` };
}

function selfTest(): void {
  const base = mkdtempSync(path.join(tmpdir(), "rival-egress-"));
  const passDir = path.join(base, "pass", "assets");
  const failDir = path.join(base, "fail");
  try {
    mkdirSync(passDir, { recursive: true });
    mkdirSync(failDir, { recursive: true });
    writeFileSync(
      path.join(passDir, "app.js"),
      'const href = "https://allowed.example/app"; const noise = "http://a/b";\n',
    );
    writeFileSync(path.join(failDir, "index.html"), '<script src="https://evil.example/track.js"></script>\n');
    const allow = ["allowed.example"];
    const pass = auditHits(scanDirectory(path.join(base, "pass")), allow);
    const fail = auditHits(scanDirectory(failDir), allow);
    const problems: string[] = [];
    if (pass.exitCode !== 0) problems.push(`allowed host exit ${pass.exitCode}, expected 0`);
    if (!pass.output.includes("allowed.example | allow")) problems.push("allowed host was not accepted");
    if (fail.exitCode === 0) problems.push("disallowed host did not fail");
    if (!fail.output.includes("evil.example | DENY")) problems.push("disallowed host was not denied");
    if (problems.length > 0) {
      console.error(problems.join("\n"));
      process.exit(1);
    }
    console.log("audit-egress self-test ok");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

function main(): number {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return 0;
  }
  if (!statSync(defaultOut, { throwIfNoEntry: false })?.isDirectory()) {
    console.error("apps/web/out is missing");
    return 1;
  }
  const allow = [...readAllowlist(allowlistPath), ...hostsFromEnv(process.env)];
  const result = auditHits(scanDirectory(defaultOut), allow);
  process.stdout.write(result.output);
  return result.exitCode;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error instanceof Error ? error.message : "audit-egress failed");
    process.exit(1);
  }
}
