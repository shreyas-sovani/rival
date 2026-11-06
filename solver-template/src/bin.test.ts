import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

it("prints help and exits 0", () => {
  const result = spawnSync(process.execPath, ["bin/index.js", "--help"], {
    cwd: root,
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/init/);
  expect(result.stdout).toMatch(/dev/);
  expect(`${result.stdout}${result.stderr}`).not.toMatch(/NOT_IMPLEMENTED/);
});
