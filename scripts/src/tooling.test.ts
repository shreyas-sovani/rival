import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isStartable, parseBacklog } from "../backlog.ts";
import { allowed, fencePatterns, packageJsonDepsOnly } from "../territory-check.ts";
import { freezeSets } from "../freeze-lib.ts";

describe("backlog parser", () => {
  const tasks = parseBacklog(readFileSync(new URL("./__fixtures__/grammar.md", import.meta.url), "utf8"));

  it("reads the grammar fixture", () => {
    expect(tasks.map((task) => task.id)).toEqual(["S-900", "M-900"]);
    expect(tasks[0]?.state).toBe("DONE");
    expect(tasks[0]?.proof).toEqual(["abcdef1 | echo ok | exit 0 | -"]);
    expect(tasks[0]?.verify).toContain("echo ok");
    expect(tasks[1]?.depends).toEqual(["S-900"]);
  });

  it("starts a task only after dependencies are DONE", () => {
    expect(isStartable(tasks[1]!, tasks, false)).toBe(true);
    const waiting = { ...tasks[1]!, depends: ["S-901"] };
    expect(isStartable(waiting, tasks, false)).toBe(false);
  });
});

describe("territory", () => {
  const markdown = readFileSync(new URL("../../BACKLOG.md", import.meta.url), "utf8");
  const slave = fencePatterns(markdown, "### 2.1 SLAVE territory");
  const master = fencePatterns(markdown, "### 2.2 MASTER territory");

  it("allows a slave path and rejects a master path", () => {
    expect(allowed("SLAVE", "CONTRIBUTING.md", slave, master, null)).toBe(true);
    expect(allowed("SLAVE", "contracts/src/Types.sol", slave, master, null)).toBe(false);
    expect(allowed("SLAVE", "scripts/src/tooling.test.ts", slave, master, null)).toBe(true);
    expect(allowed("SLAVE", "scripts/src/logic.ts", slave, master, null)).toBe(false);
    expect(allowed("SLAVE", "apps/web/src/lib/format.test.ts", slave, master, null)).toBe(true);
    expect(allowed("SLAVE", "packages/arkiv/src/client.test.ts", slave, master, null)).toBe(true);
    expect(allowed("SLAVE", "packages/solver-sdk/src/retry.test.ts", slave, master, null)).toBe(true);
    expect(allowed("SLAVE", "apps/web/src/lib/format.ts", slave, master, null)).toBe(true);
  });

  it("allows a dependency-only package.json change and rejects a scripts change by MASTER", () => {
    const before = JSON.stringify({ name: "rival", scripts: { lint: "eslint ." }, dependencies: { a: "1" } });
    const deps = JSON.stringify({ name: "rival", scripts: { lint: "eslint ." }, dependencies: { a: "2" } });
    const scripts = JSON.stringify({ name: "rival", scripts: { lint: "true" }, dependencies: { a: "1" } });
    expect(packageJsonDepsOnly(before, deps)).toBe(true);
    expect(packageJsonDepsOnly(before, scripts)).toBe(false);
    expect(allowed("MASTER", "package.json", slave, master, true)).toBe(true);
    expect(allowed("MASTER", "package.json", slave, master, false)).toBe(false);
  });
});

describe("freeze sets", () => {
  it("reads F1 through F6 from the backlog table", () => {
    const sets = freezeSets(readFileSync(new URL("../../BACKLOG.md", import.meta.url), "utf8"));
    expect(sets.map((set) => set.set)).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(sets[0]?.patterns).toContain("contracts/src/Types.sol");
  });
});
