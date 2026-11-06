import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unknown = "see upstream";

interface DepRow {
  repo: string;
  version: string;
  commit: string;
  resolved: string;
}

function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function parseDeps(markdown: string): DepRow[] {
  const rows: DepRow[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("| [")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((part) => part.trim());
    const repo = /^\[([^\]]+)\]/.exec(cells[0] ?? "")?.[1];
    const commit = /[a-f0-9]{7,40}/.exec(cells[2] ?? "")?.[0];
    if (!repo || !commit || cells.length < 4) continue;
    rows.push({
      repo,
      version: (cells[1] ?? "").replaceAll("`", ""),
      commit,
      resolved: (cells[3] ?? "").replaceAll("`", ""),
    });
  }
  return rows;
}

function classifyLicense(text: string): string | null {
  if (/Business Source License 1\.1/.test(text)) return "BUSL-1.1";
  if (/Apache License/.test(text) && /Version 2\.0/.test(text)) return "Apache-2.0";
  if (/MIT License/.test(text)) return "MIT";
  return null;
}

function readLicenseFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const name of ["LICENSE", "LICENSE.txt", "LICENSE.md", "LICENSE-MIT", "LICENSE-APACHE", "COPYING"]) {
    const file = path.join(dir, name);
    if (existsSync(file)) found.push(file);
  }
  const extra = path.join(dir, "licenses");
  if (existsSync(extra)) {
    for (const name of readdirSync(extra)) {
      if (/license/i.test(name)) found.push(path.join(extra, name));
    }
  }
  return found;
}

function licensesFromTree(dir: string): string[] {
  const found = new Set<string>();
  for (const file of readLicenseFiles(dir)) {
    const license = classifyLicense(readFileSync(file, "utf8"));
    if (license) found.add(license);
  }
  return [...found].sort();
}

function parseLockPackages(lockText: string): Map<string, Set<string>> {
  const packages = new Map<string, Set<string>>();
  const lines = lockText.split("\n");
  const start = lines.findIndex((line) => line === "packages:");
  const end = lines.findIndex((line, index) => index > start && line === "snapshots:");
  if (start < 0) return packages;
  const slice = lines.slice(start + 1, end < 0 ? undefined : end);
  for (const line of slice) {
    const match = /^ {2}(?! )(?:'([^']+)'|([^:]+)):$/.exec(line);
    const key = match?.[1] ?? match?.[2];
    if (!key || key.startsWith(".") || /\s/.test(key)) continue;
    const base = key.includes("(") ? key.slice(0, key.indexOf("(")) : key;
    const at = base.lastIndexOf("@");
    if (at <= 0) continue;
    const name = base.slice(0, at);
    const version = base.slice(at + 1);
    if (!name || !/^(@[^/]+\/)?[^@\s]+$/.test(name) || !/^\d+\.\d+\.\d+/.test(version)) continue;
    const versions = packages.get(name) ?? new Set<string>();
    versions.add(version);
    packages.set(name, versions);
  }
  return packages;
}

function licenseFromPackageJson(file: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { license?: unknown };
    const license = parsed.license;
    if (typeof license === "string" && license.trim()) return license.trim();
    if (license && typeof license === "object" && "type" in license) {
      const type = (license as { type?: unknown }).type;
      if (typeof type === "string" && type.trim()) return type.trim();
    }
  } catch {
    return null;
  }
  return null;
}

function npmLicenses(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (name: string, license: string) => {
    const current = map.get(name) ?? new Set<string>();
    current.add(license);
    map.set(name, current);
  };
  const considerDir = (dir: string, name: string) => {
    const fromPackage = licenseFromPackageJson(path.join(dir, "package.json"));
    if (fromPackage) {
      add(name, fromPackage);
      return;
    }
    for (const license of licensesFromTree(dir)) add(name, license);
  };
  const nodeModules = path.join(root, "node_modules");
  const pnpmDir = path.join(nodeModules, ".pnpm");
  if (!existsSync(pnpmDir)) return map;
  for (const entry of readdirSync(pnpmDir)) {
    const nested = path.join(pnpmDir, entry, "node_modules");
    if (!existsSync(nested)) continue;
    for (const name of readdirSync(nested)) {
      if (name.startsWith(".")) continue;
      const scopeDir = path.join(nested, name);
      if (name.startsWith("@")) {
        for (const child of readdirSync(scopeDir)) considerDir(path.join(scopeDir, child), `${name}/${child}`);
      } else {
        considerDir(scopeDir, name);
      }
    }
  }
  return map;
}

function markdownTable(header: string[], rows: string[][]): string {
  const lines = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];
  for (const row of rows) lines.push(`| ${row.map((value) => cell(value)).join(" | ")} |`);
  return lines.join("\n");
}

function build(): string {
  const depsText = readFileSync(path.join(root, "contracts/DEPS.md"), "utf8");
  const depsSaysBusl = /`v4-core` is BUSL-1\.1/.test(depsText);
  const contractRows = parseDeps(depsText).map((row) => {
    const lib = path.join(root, "contracts/lib", row.repo.split("/").pop() ?? "");
    const read = licensesFromTree(lib);
    const flagged = row.repo.endsWith("/v4-core") && (depsSaysBusl || read.includes("BUSL-1.1"));
    const licenses = flagged ? ["BUSL-1.1", ...read.filter((license) => license !== "BUSL-1.1")] : read;
    return [
      row.repo,
      row.version,
      row.commit,
      row.resolved,
      licenses.length > 0 ? licenses.join(", ") : unknown,
      flagged ? "BUSL-1.1" : "",
    ];
  });
  const locked = parseLockPackages(readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8"));
  const installed = npmLicenses();
  const npmRows = [...locked.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, versions]) => {
      const licenses = [...(installed.get(name) ?? [])].sort();
      const flagged = name === "@uniswap/v4-core" || name === "v4-core";
      const licenseCell = flagged
        ? ["BUSL-1.1", ...licenses.filter((license) => license !== "BUSL-1.1")].join(", ")
        : licenses.join(", ") || unknown;
      return [name, [...versions].sort().join(", "), licenseCell, flagged && depsSaysBusl ? "BUSL-1.1" : ""];
    });
  return [
    "# Third-party notices",
    "",
    "Generated by `scripts/licenses-table.ts` from `contracts/DEPS.md` and `pnpm-lock.yaml`.",
    "A license cell is filled only from a license file or a package.json `license` field this script read. Unread licenses are `see upstream`.",
    depsSaysBusl ? "`v4-core` is flagged BUSL-1.1 because `contracts/DEPS.md` says so." : "",
    "",
    "## Contract dependencies",
    "",
    markdownTable(["Repo", "Version", "Commit", "Resolved", "License", "Flag"], contractRows),
    "",
    "## npm packages",
    "",
    markdownTable(["Package", "Versions", "License", "Flag"], npmRows),
    "",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}

function main(): void {
  const output = build();
  const destination = path.join(root, "THIRD_PARTY.md");
  writeFileSync(destination, output);
  const contracts = parseDeps(readFileSync(path.join(root, "contracts/DEPS.md"), "utf8")).length;
  console.log(`wrote THIRD_PARTY.md (${contracts} contract rows)`);
  if (!output.includes("BUSL-1.1")) {
    console.error("v4-core BUSL-1.1 flag missing");
    process.exit(1);
  }
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();
