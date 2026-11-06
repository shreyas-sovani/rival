import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { expandSets, type FreezeDoc } from "./freeze-lib.ts";

const path = "specs/FREEZE.json";

function readDoc(): FreezeDoc {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as FreezeDoc;
  } catch {
    return { version: 0, files: [], changelog: [] };
  }
}

const bumpAt = process.argv.indexOf("--bump");
if (bumpAt < 0) {
  console.error('usage: freeze-write.ts --bump "<reason>"');
  process.exit(2);
}
const reason = process.argv[bumpAt + 1];
if (!reason) {
  console.error("missing bump reason");
  process.exit(2);
}

const markdown = readFileSync("BACKLOG.md", "utf8");
const doc = readDoc();
doc.version += 1;
doc.files = expandSets(markdown);
doc.changelog.push({ version: doc.version, time: new Date().toISOString(), reason });
mkdirSync("specs", { recursive: true });
writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`wrote ${path} v${doc.version}`);
