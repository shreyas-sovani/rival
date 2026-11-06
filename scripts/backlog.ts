import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export interface TaskBlock {
  id: string;
  title: string;
  state: string;
  owner: string;
  depends: string[];
  verify: string;
  proof: string[];
  blockedBy: string;
  raw: string;
}

const TASK_HEADING = /^### ([A-Z]+-\d+) — (.+)$/;
const FIELD = /^- ([A-Z][A-Z0-9-]*):\s?(.*)$/;

export function parseBacklog(markdown: string): TaskBlock[] {
  const tasks: TaskBlock[] = [];
  let current: TaskBlock | null = null;
  let field = "";
  let buffer: string[] = [];
  let inFence = false;

  const flushField = () => {
    if (!current || !field) return;
    const text = buffer.join("\n").trim();
    if (field === "STATE") current.state = firstLine(text);
    if (field === "OWNER") current.owner = firstLine(text);
    if (field === "DEPENDS") current.depends = splitDepends(firstLine(text));
    if (field === "VERIFY") {
      current.verify = text.replace(/^```(?:bash)?/, "").replace(/```$/, "").trim();
    }
    if (field === "BLOCKED-BY") current.blockedBy = firstLine(text);
    field = "";
    buffer = [];
  };

  for (const line of markdown.split("\n")) {
    const heading = line.match(TASK_HEADING);
    if (heading) {
      flushField();
      if (current) tasks.push(current);
      current = emptyTask(heading[1] ?? "", heading[2] ?? "");
      continue;
    }
    if (!current) continue;
    if (line.trim().startsWith("```")) inFence = !inFence;
    const match = inFence ? null : line.match(FIELD);
    if (match) {
      if (match[1] === "PROOF") {
        const value = (match[2] ?? "").trim();
        if (value) current.proof.push(value);
        continue;
      }
      flushField();
      field = match[1] ?? "";
      buffer = [match[2] ?? ""];
      continue;
    }
    if (field) buffer.push(line);
  }
  flushField();
  if (current) tasks.push(current);
  return tasks;
}

function emptyTask(id: string, title: string): TaskBlock {
  return { id, title, state: "", owner: "", depends: [], verify: "", proof: [], blockedBy: "", raw: "" };
}

function firstLine(value: string): string {
  return value.split("\n")[0]?.trim() ?? "";
}

function splitDepends(value: string): string[] {
  if (!value || value === "—" || value === "-") return [];
  return value
    .split(/[, ]+/)
    .map((part) => part.trim())
    .filter((part) => /^[A-Z]+-\d+$/.test(part) || /^F\d+$/.test(part));
}

const PROOF_RE = /^[0-9a-f]{7,40} \| .+ \| .{1,120} \| (\S+)$/;

export function proofErrors(task: TaskBlock): string[] {
  if (task.state !== "DONE") return [];
  const errors: string[] = [];
  if (task.proof.length === 0) errors.push(`${task.id} DONE without PROOF`);
  for (const line of task.proof) {
    if (!PROOF_RE.test(line)) errors.push(`${task.id} PROOF format: ${line.slice(0, 80)}`);
    const sha = line.split("|")[0]?.trim() ?? "";
    if (sha && !commitExists(sha)) errors.push(`${task.id} PROOF sha missing: ${sha}`);
  }
  return errors;
}

function commitExists(sha: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function isStartable(task: TaskBlock, tasks: TaskBlock[], freezeExists: boolean): boolean {
  if (task.state !== "TODO" && task.state !== "REWORK") return false;
  const byId = new Map(tasks.map((item) => [item.id, item]));
  for (const dep of task.depends) {
    if (/^F\d+$/.test(dep)) {
      if (freezeExists) continue;
      continue;
    }
    const other = byId.get(dep);
    if (!other || other.state !== "DONE") return false;
  }
  return true;
}

export function nextTask(owner: string, tasks: TaskBlock[], freezeExists: boolean): TaskBlock | undefined {
  const mine = tasks.filter((task) => task.owner === owner);
  return (
    mine.find((task) => task.state === "REWORK" && isStartable(task, tasks, freezeExists)) ??
    mine.find((task) => isStartable(task, tasks, freezeExists))
  );
}

export function boardText(tasks: TaskBlock[], freezeExists: boolean): string {
  const counts = new Map<string, number>();
  for (const task of tasks) counts.set(task.state || "?", (counts.get(task.state || "?") ?? 0) + 1);
  const lines = ["COUNTS"];
  for (const state of ["TODO", "WORKING", "BLOCKED", "REWORK", "DONE"]) {
    lines.push(`${state} ${counts.get(state) ?? 0}`);
  }
  lines.push("NEXT");
  for (const owner of ["MASTER", "SLAVE", "FOUNDER"]) {
    const next = nextTask(owner, tasks, freezeExists);
    lines.push(`${owner} ${next ? next.id : "-"}`);
  }
  lines.push("BLOCKED");
  const blocked = tasks
    .filter((task) => task.state === "BLOCKED")
    .map((task) => `${task.id} ${task.blockedBy || "unspecified"}`)
    .sort((a, b) => a.split(" ")[1]!.localeCompare(b.split(" ")[1]!));
  lines.push(...blocked);
  return lines.join("\n");
}

function freezeExists(): boolean {
  try {
    readFileSync("specs/FREEZE.json", "utf8");
    return true;
  } catch {
    return false;
  }
}

function runVerify(task: TaskBlock): number {
  if (!task.verify) return 0;
  try {
    execFileSync("bash", ["-lc", task.verify], { stdio: "inherit" });
    return 0;
  } catch {
    console.error(`VERIFY failed ${task.id}`);
    return 1;
  }
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  const markdown = readFileSync("BACKLOG.md", "utf8");
  const tasks = parseBacklog(markdown);
  const frozen = freezeExists();
  if (command === "board") {
    console.log(boardText(tasks, frozen));
    return;
  }
  if (command === "verify") {
    const only = rest.includes("--task") ? rest[rest.indexOf("--task") + 1] : "";
    const run = rest.includes("--run");
    const selected = only ? tasks.filter((task) => task.id === only) : tasks;
    const errors = selected.flatMap((task) => proofErrors(task));
    for (const error of errors) console.error(error);
    let failed = errors.length;
    if (run) {
      for (const task of selected.filter((item) => item.state === "DONE")) failed += runVerify(task);
    }
    if (failed > 0) process.exit(1);
    console.log(`OK ${selected.length} tasks`);
    return;
  }
  console.error("usage: backlog.ts board|verify [--task ID] [--run]");
  process.exit(2);
}

const invoked = process.argv[1]?.endsWith("backlog.ts");
if (invoked) main();
