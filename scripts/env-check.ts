import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Fake value used only inside --self-test. It must never be written to stdout. */
const SENTINEL = "supersecret-do-not-print-9f3a";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXAMPLE_FILE = new Map<string, string>([
  ["web-build", "apps/web/.env.example"],
  ["runner", "apps/runner/.env.example"],
  ["operator", ".env.example"],
  ["solver-template", "solver-template/.env.example"],
  ["ci", ".env.example"],
]);

const REPORT = /^(OK|MISSING: [A-Z][A-Z0-9_]*(,[A-Z][A-Z0-9_]*)*)$/;

export interface EnvVariable {
  name: string;
  description: string;
  secret: boolean;
  humanTask: string;
}

export interface EnvTarget {
  name: string;
  variables: readonly EnvVariable[];
}

interface SelfTestResult {
  ok: boolean;
  reason: string;
  stdout: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new Error("invalid env schema");
}

function humanTaskFrom(comment: string): string {
  const match = /^humanTask=([A-Za-z0-9-]+)$/.exec(comment.trim());
  return match?.[1] ?? "none";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) invalid();
  return value as string[];
}

export function parseCatalog(raw: unknown): EnvTarget[] {
  if (!isRecord(raw) || !isRecord(raw.properties)) invalid();
  const targets: EnvTarget[] = [];
  for (const name of stringList(raw.required)) {
    const node = raw.properties[name];
    if (!isRecord(node) || !isRecord(node.properties)) invalid();
    const variables: EnvVariable[] = [];
    for (const varName of stringList(node.required)) {
      const spec = node.properties[varName];
      const record = isRecord(spec) ? spec : {};
      const description = typeof record.description === "string" ? record.description : "";
      const comment = typeof record.$comment === "string" ? record.$comment : "";
      variables.push({
        name: varName,
        description,
        secret: record.writeOnly === true,
        humanTask: humanTaskFrom(comment),
      });
    }
    targets.push({ name, variables });
  }
  return targets;
}

function stripExport(trimmed: string): string {
  const match = /^export\s+(.+)$/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function unquote(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseEnv(text: string): Map<string, string> {
  const env = new Map<string, string>();
  for (const rawLine of text.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const body = stripExport(trimmed);
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env.set(key, unquote(body.slice(eq + 1).trim()));
  }
  return env;
}

export function mergeEnv(
  fileEnv: ReadonlyMap<string, string>,
  processEnv: Readonly<Record<string, string | undefined>>,
): Map<string, string> {
  const merged = new Map(fileEnv);
  for (const [key, value] of Object.entries(processEnv)) {
    if (typeof value === "string") merged.set(key, value);
  }
  return merged;
}

export function missingNames(target: EnvTarget, env: ReadonlyMap<string, string>): string[] {
  const missing: string[] = [];
  for (const variable of target.variables) {
    const value = env.get(variable.name);
    if (value === undefined || value.trim() === "") missing.push(variable.name);
  }
  return missing;
}

export function formatReport(missing: readonly string[]): string {
  if (missing.length === 0) return "OK";
  return `MISSING: ${missing.join(",")}`;
}

export function checkTarget(
  target: EnvTarget,
  fileText: string | null,
  processEnv: Readonly<Record<string, string | undefined>>,
): string {
  const fileEnv = fileText === null ? new Map<string, string>() : parseEnv(fileText);
  return formatReport(missingNames(target, mergeEnv(fileEnv, processEnv)));
}

function text(lines: readonly string[]): string {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") end -= 1;
  return `${lines.slice(0, end).join("\n")}\n`;
}

function oneLine(value: string): string {
  return value.replaceAll("\r\n", " ").replaceAll("\n", " ").replaceAll("\r", " ");
}

function mdCell(value: string): string {
  return oneLine(value).replaceAll("|", "\\|").replaceAll("`", "'");
}

function groupExamples(catalog: readonly EnvTarget[]): Map<string, EnvTarget[]> {
  const groups = new Map<string, EnvTarget[]>();
  for (const target of catalog) {
    const file = EXAMPLE_FILE.get(target.name);
    if (!file) throw new Error(`no example path for ${target.name}`);
    const existing = groups.get(file);
    if (existing) existing.push(target);
    else groups.set(file, [target]);
  }
  return groups;
}

function renderExample(targets: readonly EnvTarget[]): string {
  const lines = ["# Generated from specs/env.schema.json. No values.", ""];
  for (const target of targets) {
    lines.push(`# target: ${target.name}`, "");
    for (const variable of target.variables) {
      const secret = variable.secret ? "true" : "false";
      lines.push(
        `# ${oneLine(variable.description)}`,
        `# secret=${secret} humanTask=${variable.humanTask}`,
        `${variable.name}=`,
        "",
      );
    }
  }
  return text(lines);
}

function renderDocs(catalog: readonly EnvTarget[]): string {
  const lines = [
    "# Environment",
    "",
    "Generated from `specs/env.schema.json`. This file lists names, descriptions, secret flags, and owning human tasks. It contains no values.",
    "",
    "Secrets go in `secrets/.env.local` (gitignored). Check one target with:",
    "",
    "```bash",
    "node --experimental-strip-types scripts/env-check.ts --target <target>",
    "```",
    "",
    "The command loads `secrets/.env.local` when that file exists, then process environment. It prints `OK` or `MISSING: NAME,NAME` and exits 1 when a required name is absent or blank. It never prints values.",
    "",
    "## Project metadata",
    "",
    "H-001 writes the legal name used as the MIT license holder.",
    "",
    "FOUNDER_NAME=FILL(FOUNDER_NAME)",
    "",
    "## Example files",
    "",
    "| Target | File |",
    "| --- | --- |",
  ];
  for (const target of catalog) {
    const file = EXAMPLE_FILE.get(target.name);
    if (!file) throw new Error(`no example path for ${target.name}`);
    lines.push(`| ${target.name} | \`${file}\` |`);
  }
  lines.push(
    "",
    "Operator and ci share `.env.example`. Each target is its own commented section. The other targets have their own example files.",
    "",
  );
  for (const target of catalog) {
    const file = EXAMPLE_FILE.get(target.name);
    if (!file) throw new Error(`no example path for ${target.name}`);
    lines.push(
      `## ${target.name}`,
      "",
      `Example: \`${file}\``,
      "",
      "| Name | Secret | Human task | Description |",
      "| --- | --- | --- | --- |",
    );
    for (const variable of target.variables) {
      const secret = variable.secret ? "yes" : "no";
      lines.push(
        `| \`${variable.name}\` | ${secret} | ${variable.humanTask} | ${mdCell(variable.description)} |`,
      );
    }
    lines.push("");
  }
  return text(lines);
}

function assignmentHasValue(contents: string): boolean {
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0 || trimmed.slice(eq + 1) !== "") return true;
  }
  return false;
}

function generatedFilesMatch(catalog: readonly EnvTarget[]): boolean {
  let groups: Map<string, EnvTarget[]>;
  try {
    groups = groupExamples(catalog);
  } catch {
    return false;
  }
  for (const [file, targets] of groups) {
    const rendered = renderExample(targets);
    if (assignmentHasValue(rendered) || rendered.includes(SENTINEL)) return false;
    let onDisk: string;
    try {
      onDisk = readFileSync(path.join(root, file), "utf8");
    } catch {
      return false;
    }
    if (onDisk !== rendered) return false;
  }
  let renderedDocs: string;
  try {
    renderedDocs = renderDocs(catalog);
  } catch {
    return false;
  }
  if (renderedDocs.includes(SENTINEL)) return false;
  let docs: string;
  try {
    docs = readFileSync(path.join(root, "docs/ENV.md"), "utf8");
  } catch {
    return false;
  }
  return docs === renderedDocs;
}

function namesOf(target: EnvTarget): string {
  return target.variables.map((variable) => variable.name).join(",");
}

function leaked(report: string): boolean {
  return report.includes(SENTINEL) || report.includes("=") || !REPORT.test(report);
}

export function selfTest(target: EnvTarget, catalog: readonly EnvTarget[]): SelfTestResult {
  const fail = (reason: string): SelfTestResult => ({ ok: false, reason, stdout: "" });
  const first = target.variables[0];
  const second = target.variables[1];
  if (!first || !second) return fail("absence");

  const presentFile = target.variables
    .map((variable, index) => {
      if (index === 0) return `export ${variable.name}="${SENTINEL}"`;
      if (index === 1) return `${variable.name}='${SENTINEL}'`;
      return `${variable.name}=${SENTINEL}`;
    })
    .join("\n");
  const absentFile = target.variables
    .slice(2)
    .map((variable, index) =>
      index === 0 ? `export ${variable.name}="${SENTINEL}"` : `${variable.name}=${SENTINEL}`,
    )
    .join("\n");
  const processOnly: Record<string, string> = {};
  for (const variable of target.variables) processOnly[variable.name] = SENTINEL;

  const presence = checkTarget(target, presentFile, {});
  const absence = checkTarget(target, absentFile, {});
  const processReport = checkTarget(target, null, processOnly);
  const blankOverride = checkTarget(target, presentFile, { [first.name]: " \t" });
  const blankFile = checkTarget(
    target,
    target.variables.map((variable) => `${variable.name}=`).join("\n"),
    {},
  );
  const extraKey = checkTarget(target, `${presentFile}\nNOT_A_REQUIRED=${SENTINEL}\n`, {});
  const none = checkTarget(target, null, {});
  const reports = [presence, absence, processReport, blankOverride, blankFile, extraKey, none];

  const reasons: string[] = [];
  if (presence !== "OK") reasons.push("presence");
  if (absence !== `MISSING: ${first.name},${second.name}`) reasons.push("absence");
  if (processReport !== "OK") reasons.push("process-only");
  if (blankOverride !== `MISSING: ${first.name}`) reasons.push("blank-override");
  if (blankFile !== `MISSING: ${namesOf(target)}`) reasons.push("blank-file");
  if (extraKey !== "OK") reasons.push("extra-key");
  if (none !== `MISSING: ${namesOf(target)}`) reasons.push("all-missing");
  if (reports.some((report) => leaked(report))) reasons.push("value-printed");
  if (!generatedFilesMatch(catalog)) reasons.push("generated-files");

  if (reasons.length > 0) return fail(reasons.join(","));
  return {
    ok: true,
    reason: "",
    stdout: `${presence}\n${absence}\nSELF-TEST OK\n`,
  };
}

function loadCatalog(): EnvTarget[] {
  let body: string;
  try {
    body = readFileSync(path.join(root, "specs/env.schema.json"), "utf8");
  } catch {
    throw new Error("cannot read specs/env.schema.json");
  }
  try {
    return parseCatalog(JSON.parse(body) as unknown);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid env schema") throw error;
    throw new Error("invalid env schema");
  }
}

function usage(catalog: readonly EnvTarget[]): string {
  const names = catalog.map((target) => target.name).join("|");
  return `usage: env-check.ts --target <${names}> [--self-test|--print-names]`;
}

function flagValue(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function requireTarget(argv: readonly string[], catalog: readonly EnvTarget[]): EnvTarget | null {
  let name: string | null;
  try {
    name = flagValue(argv, "--target");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "usage");
    return null;
  }
  if (name === null) {
    console.error(usage(catalog));
    return null;
  }
  const target = catalog.find((item) => item.name === name);
  if (!target) {
    const known = catalog.map((item) => item.name).join(", ");
    console.error(`unknown target. expected ${known}`);
    return null;
  }
  return target;
}

function emit(catalog: readonly EnvTarget[]): number {
  for (const [file, targets] of groupExamples(catalog)) {
    const rendered = renderExample(targets);
    if (assignmentHasValue(rendered))
      throw new Error("refusing to write an example that has a value");
    writeFileSync(path.join(root, file), rendered, "utf8");
  }
  const docs = renderDocs(catalog);
  if (docs.includes(SENTINEL)) throw new Error("refusing to write docs");
  writeFileSync(path.join(root, "docs/ENV.md"), docs, "utf8");
  console.log("OK");
  return 0;
}

function readSecretsFile(): string | null {
  const file = path.join(root, "secrets/.env.local");
  if (!existsSync(file)) return null;
  try {
    return readFileSync(file, "utf8");
  } catch {
    throw new Error("cannot read secrets/.env.local");
  }
}

function main(argv: readonly string[]): number {
  const catalog = loadCatalog();
  if (argv.includes("--self-test")) {
    const target = requireTarget(argv, catalog);
    if (!target) return 1;
    const result = selfTest(target, catalog);
    if (!result.ok) {
      console.error(`SELF-TEST FAIL ${result.reason}`);
      return 1;
    }
    process.stdout.write(result.stdout);
    return 0;
  }
  if (argv.includes("--emit")) return emit(catalog);
  const target = requireTarget(argv, catalog);
  if (!target) return 1;
  if (argv.includes("--print-names")) {
    for (const variable of target.variables) console.log(variable.name);
    return 0;
  }
  const report = checkTarget(target, readSecretsFile(), process.env);
  console.log(report);
  return report === "OK" ? 0 : 1;
}

const invoked = process.argv[1]?.endsWith("env-check.ts");
if (invoked) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "env-check failed");
    process.exit(1);
  }
}
