import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "ens-role-check.ts");

const holder = "0x1111111111111111111111111111111111111111";

const expected = [
  { role: "ROLE_REGISTRAR", holder, resource: "0" },
  { role: "ROLE_RENEW", holder, resource: "0" },
  { role: "ROLE_UNREGISTER", holder, resource: "0" },
];

function run(expectRows: unknown[], roleRows: unknown[]) {
  const dir = mkdtempSync(path.join(tmpdir(), "ens-roles-"));
  const expectPath = path.join(dir, "expect.json");
  const rolesPath = path.join(dir, "roles.json");
  writeFileSync(expectPath, JSON.stringify(expectRows));
  writeFileSync(rolesPath, JSON.stringify(roleRows));
  const env = { ...process.env };
  delete env.NODE_CHANNEL_FD;
  delete env.NODE_TEST_CONTEXT;
  try {
    return spawnSync(process.execPath, ["--import", "tsx", script, "--expect", expectPath, "--roles", rolesPath], {
      cwd: root,
      encoding: "utf8",
      env,
      timeout: 20000,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("matching tables exit 0", () => {
  const result = run(expected, expected);
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /status\s+role\s+holder\s+resource/);
  assert.match(result.stdout, /OK\s+ROLE_REGISTRAR/);
  assert.match(result.stdout, /OK\s+ROLE_RENEW/);
  assert.match(result.stdout, /OK\s+ROLE_UNREGISTER/);
  assert.doesNotMatch(result.stdout, /MISSING|EXTRA/);
});

test("a missing role exits 1", () => {
  const actual = expected.filter((row) => row.role !== "ROLE_RENEW");
  const result = run(expected, actual);
  assert.equal(result.status, 1, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /MISSING\s+ROLE_RENEW/);
});

test("an unexpected extra role exits 1", () => {
  const actual = [...expected, { role: "ROLE_SET_RESOLVER", holder, resource: "0" }];
  const result = run(expected, actual);
  assert.equal(result.status, 1, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /EXTRA\s+ROLE_SET_RESOLVER/);
  assert.match(result.stdout, /OK\s+ROLE_REGISTRAR/);
});
