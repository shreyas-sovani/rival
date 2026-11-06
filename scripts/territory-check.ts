import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export type Role = "MASTER" | "SLAVE";

export function fencePatterns(markdown: string, heading: string): string[] {
  const start = markdown.indexOf(heading);
  if (start < 0) return [];
  const fence = markdown.indexOf("```", start);
  const end = markdown.indexOf("```", fence + 3);
  const body = markdown.slice(fence + 3, end);
  return body
    .split(/[\n,]/)
    .map((part) => part.replace(/\(.*?\)/g, "").trim())
    .filter((part) => part && !part.startsWith("#"));
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ":::DEEP:::")
    .replace(/\*/g, "[^/]*")
    .replace(/:::DEEP:::/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function roleForPath(path: string, slave: string[], master: string[]): Role {
  if (slave.some((pattern) => globToRegExp(pattern).test(path))) return "SLAVE";
  if (master.some((pattern) => globToRegExp(pattern).test(path))) return "MASTER";
  return "MASTER";
}

const DEP_KEYS = new Set(["dependencies", "devDependencies", "peerDependencies"]);

export function packageJsonDepsOnly(before: string, after: string): boolean {
  const left = JSON.parse(before) as Record<string, unknown>;
  const right = JSON.parse(after) as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (DEP_KEYS.has(key)) continue;
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) return false;
  }
  return true;
}

function toolingFixture(path: string): boolean {
  return (
    path === "scripts/freeze-lib.ts" ||
    /^scripts\/src\/.*\.test\.ts$/.test(path) ||
    /^scripts\/src\/__fixtures__\//.test(path)
  );
}

/** Task specs require unit tests next to files the §2 fence names without a glob. */
function slaveTaskTest(path: string): boolean {
  return (
    /^apps\/web\/src\/lib\/.*\.test\.ts$/.test(path) ||
    /^apps\/web\/src\/testids\.test\.ts$/.test(path) ||
    /^packages\/arkiv\/src\/(client|rotation)\.test\.ts$/.test(path) ||
    /^packages\/solver-sdk\/src\/(rpc-pool|retry)\.test\.ts$/.test(path) ||
    path === "apps/runner/src/logger.test.ts" ||
    path === "apps/web/tsconfig.json" ||
    path === "apps/web/next-env.d.ts" ||
    path === "apps/web/vitest.config.ts" ||
    path === "apps/web/connect-src.json"
  );
}

export function allowed(role: Role, path: string, slave: string[], master: string[], depsOnly: boolean | null): boolean {
  if (path === "BACKLOG.md") return true;
  if (role === "SLAVE" && (toolingFixture(path) || slaveTaskTest(path) || path === "scripts/tsconfig.json" || path === "scripts/vitest.config.ts")) {
    return true;
  }
  if (path === "pnpm-lock.yaml" || path.endsWith("/pnpm-lock.yaml")) return true;
  if (path === "package.json" || path.endsWith("/package.json")) {
    if (depsOnly === true) return true;
    if (depsOnly === false && role === "MASTER") return false;
  }
  return roleForPath(path, slave, master) === role;
}

function stagedFiles(): string[] {
  const out = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { encoding: "utf8" });
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

function depsOnlyFor(path: string): boolean | null {
  if (!path.endsWith("package.json")) return null;
  try {
    const before = execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" });
    const after = execFileSync("git", ["show", `:${path}`], { encoding: "utf8" });
    return packageJsonDepsOnly(before, after);
  } catch {
    return false;
  }
}

export function selfTest(): void {
  const markdown = readFileSync("BACKLOG.md", "utf8");
  const slave = fencePatterns(markdown, "### 2.1 SLAVE territory");
  const master = fencePatterns(markdown, "### 2.2 MASTER territory");
  const cases: Array<[string, boolean]> = [
    ["allowed path", allowed("SLAVE", "CONTRIBUTING.md", slave, master, null)],
    ["forbidden path", !allowed("SLAVE", "contracts/src/Types.sol", slave, master, null)],
    ["deps-only package.json", allowed("MASTER", "package.json", slave, master, true)],
    ["scripts key by MASTER", !allowed("MASTER", "package.json", slave, master, false)],
    ["web lib test", allowed("SLAVE", "apps/web/src/lib/format.test.ts", slave, master, null)],
  ];
  const failed = cases.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length > 0) {
    console.error(`SELF-TEST FAIL ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log("SELF-TEST OK");
}

function main(): void {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const role = process.env.AGENT_ROLE;
  if (role !== "MASTER" && role !== "SLAVE") {
    console.error("AGENT_ROLE must be MASTER or SLAVE");
    process.exit(1);
  }
  const markdown = readFileSync("BACKLOG.md", "utf8");
  const slave = fencePatterns(markdown, "### 2.1 SLAVE territory");
  const master = fencePatterns(markdown, "### 2.2 MASTER territory");
  const bad: string[] = [];
  for (const path of stagedFiles()) {
    const depsOnly = depsOnlyFor(path);
    if (!allowed(role, path, slave, master, depsOnly)) bad.push(path);
  }
  if (bad.length > 0) {
    console.error(`territory: ${role} cannot stage ${bad.join(", ")}`);
    process.exit(1);
  }
  console.log(`territory OK ${role}`);
}

const invoked = process.argv[1]?.endsWith("territory-check.ts");
if (invoked) main();
