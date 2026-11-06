import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { grantsFromBitmap } from "./ens-role-check.ts";

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

test("0x11001 is exactly the three root roles", () => {
  const grants = grantsFromBitmap(0x11001n, holder);
  assert.deepEqual(
    grants.map((grant) => grant.role).sort(),
    ["ROLE_REGISTRAR", "ROLE_RENEW", "ROLE_UNREGISTER"],
  );
  assert.equal(
    grants.every((grant) => grant.holder === holder && grant.resource === "0"),
    true,
  );
});

test("an extra registry bit is named", () => {
  const grants = grantsFromBitmap(0x11001n | (1n << 24n), holder);
  assert.equal(
    grants.some((grant) => grant.role === "ROLE_SET_RESOLVER"),
    true,
  );
});

test("a zero solvers registry exits 2", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ens-roles-"));
  const expectPath = path.join(dir, "expect.json");
  const deploymentsPath = path.join(dir, "deployments.json");
  writeFileSync(expectPath, JSON.stringify(expected));
  writeFileSync(
    deploymentsPath,
    JSON.stringify({
      names: "0x0000000000000000000000000000000000000000",
      ens: { solversRegistry: "0x0000000000000000000000000000000000000000" },
    }),
  );
  const env = { ...process.env };
  delete env.NODE_CHANNEL_FD;
  delete env.NODE_TEST_CONTEXT;
  try {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", script, "--expect", expectPath, "--deployments", deploymentsPath],
      { cwd: root, encoding: "utf8", env, timeout: 20000 },
    );
    assert.equal(result.status, 2, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /BLOCKED: solvers registry or RivalNames address is zero/);
    assert.doesNotMatch(result.stdout, /undeployed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unexpected extra role exits 1", () => {
  const actual = [...expected, { role: "ROLE_SET_RESOLVER", holder, resource: "0" }];
  const result = run(expected, actual);
  assert.equal(result.status, 1, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /EXTRA\s+ROLE_SET_RESOLVER/);
  assert.match(result.stdout, /OK\s+ROLE_REGISTRAR/);
});
