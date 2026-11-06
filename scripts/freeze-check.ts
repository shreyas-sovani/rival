import { readFileSync } from "node:fs";
import { expandSets, type FreezeDoc } from "./freeze-lib.ts";

const sinceAt = process.argv.indexOf("--since");
const since = sinceAt >= 0 ? Number(process.argv[sinceAt + 1]) : null;

let doc: FreezeDoc;
try {
  doc = JSON.parse(readFileSync("specs/FREEZE.json", "utf8")) as FreezeDoc;
} catch {
  console.error("missing specs/FREEZE.json");
  process.exit(2);
}

if (since !== null) {
  const sets = new Set(doc.changelog.filter((entry) => entry.version > since).flatMap(() => doc.files.map((file) => file.set)));
  console.log([...sets].sort().join("\n") || "(none)");
  process.exit(0);
}

const current = new Map(expandSets(readFileSync("BACKLOG.md", "utf8")).map((file) => [file.path, file]));
const recorded = new Map(doc.files.map((file) => [file.path, file]));
const problems: string[] = [];
for (const [path, file] of recorded) {
  const now = current.get(path);
  if (!now || !now.sha256) problems.push(`missing ${file.set} ${path}`);
  else if (now.sha256 !== file.sha256) problems.push(`changed ${file.set} ${path}`);
}
for (const [path, file] of current) {
  if (!recorded.has(path) && file.sha256) problems.push(`extra ${file.set} ${path}`);
}
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(2);
}
console.log(`freeze OK v${doc.version}`);
