import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface FreezeFile {
  path: string;
  sha256: string;
  set: string;
}

export interface FreezeDoc {
  version: number;
  files: FreezeFile[];
  changelog: Array<{ version: number; time: string; reason: string }>;
}

export function freezeSets(markdown: string): Array<{ set: string; patterns: string[] }> {
  const rows = markdown.split("\n").filter((line) => /^\| F\d+ \|/.test(line));
  return rows.map((row) => {
    const cells = row.split("|").map((cell) => cell.trim());
    const set = cells[1] ?? "";
    const patterns = [...(cells[2] ?? "").matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? "");
    return { set, patterns };
  });
}

function walk(pattern: string): string[] {
  if (pattern.endsWith("/**")) return walkDir(pattern.slice(0, -3));
  if (!pattern.includes("*")) return [pattern];
  const slash = pattern.lastIndexOf("/");
  const base = slash >= 0 ? pattern.slice(0, slash) : ".";
  const namePattern = pattern.slice(slash + 1);
  return readdirSync(base)
    .filter((entry) => globName(namePattern, entry))
    .map((entry) => join(base, entry));
}

function globName(pattern: string, name: string): boolean {
  const re = new RegExp(`^${pattern.replace(".", "\\.").replace("*", ".*")}$`);
  return re.test(name);
}

function walkDir(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walkDir(path));
    else out.push(path);
  }
  return out;
}

export function expandSets(markdown: string): FreezeFile[] {
  const files: FreezeFile[] = [];
  for (const { set, patterns } of freezeSets(markdown)) {
    for (const pattern of patterns) {
      for (const path of walk(pattern)) {
        try {
          const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
          files.push({ path, sha256, set });
        } catch {
          files.push({ path, sha256: "", set });
        }
      }
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
