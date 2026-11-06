import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preflightChecks, type PreflightCheck } from "./preflight.config.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Status = "PASS" | "FAIL" | "NOT_IMPLEMENTED";

interface Args {
  list: boolean;
  only: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  let list = false;
  let only: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") {
      list = true;
      continue;
    }
    if (arg === "--only") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("--only needs a check id");
      only = value;
      i += 1;
      continue;
    }
    if (arg?.startsWith("--only=")) {
      only = arg.slice("--only=".length);
      if (!only) throw new Error("--only needs a check id");
      continue;
    }
    throw new Error(`unknown argument ${arg ?? ""}`);
  }
  return { list, only };
}

function selectChecks(only: string | null): PreflightCheck[] {
  if (!only) return preflightChecks;
  return preflightChecks.filter((check) => check.id === only || check.owner === only);
}

function printList(checks: readonly PreflightCheck[]): void {
  console.log("id\towner\tautoRunnable\ttitle");
  for (const check of checks) {
    console.log(`${check.id}\t${check.owner}\t${check.autoRunnable}\t${check.title}`);
  }
  console.log(`${checks.length} checks`);
}

function classify(status: number | null, output: string): Status {
  if (status === 3 || /NOT_IMPLEMENTED\([^)]*\)/.test(output)) return "NOT_IMPLEMENTED";
  if (status === 0) return "PASS";
  return "FAIL";
}

function runCheck(check: PreflightCheck): Status {
  const result = spawnSync(check.command, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    timeout: 120_000,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const status = classify(result.status, output);
  const token = output.match(/NOT_IMPLEMENTED\([^)]*\)/)?.[0];
  const suffix = status === "NOT_IMPLEMENTED" && token ? ` ${token}` : "";
  console.log(`${status} ${check.id}${suffix}`);
  if (status === "FAIL") {
    const tail = output
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .slice(-20);
    for (const line of tail) console.log(`  ${line}`);
  }
  return status;
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const checks = selectChecks(args.only);
  if (checks.length === 0) {
    console.error(`no preflight check matches ${args.only ?? ""}`);
    return 1;
  }
  if (args.list) {
    printList(checks);
    return 0;
  }
  const results = checks.map((check) => runCheck(check));
  if (results.some((status) => status === "FAIL")) return 1;
  if (results.some((status) => status === "NOT_IMPLEMENTED")) return 3;
  return 0;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error instanceof Error ? error.message : "preflight failed");
    process.exit(1);
  }
}
