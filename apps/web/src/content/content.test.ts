import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DISCLAIMER_BANNER, PUBLIC_INTENTS_PRD } from "./disclaimers.ts";
import { KNOWN_LIMIT, KNOWN_LIMIT_BODY, SPONSOR_EVIDENCE } from "./evidence-copy.ts";
import { SOLVER_DEV_COMMAND, SOLVER_INIT_COMMAND } from "./run-a-solver.ts";
import { TROUBLESHOOTING } from "./troubleshooting.ts";

const prd = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../../PRD.md"), "utf8");

describe("static copy matches the PRD", () => {
  it("keeps the testnet banner", () => {
    expect(prd).toContain(DISCLAIMER_BANNER);
  });

  it("keeps the troubleshooting card", () => {
    for (const line of TROUBLESHOOTING) expect(prd).toContain(line);
  });

  it("keeps the sponsor evidence lines", () => {
    for (const line of Object.values(SPONSOR_EVIDENCE)) expect(prd).toContain(line);
  });

  it("keeps the known limit and the public-intents line", () => {
    expect(prd).toContain(KNOWN_LIMIT_BODY);
    expect(KNOWN_LIMIT).toBe(`Known limit: ${KNOWN_LIMIT_BODY}`);
    expect(prd).toContain(PUBLIC_INTENTS_PRD);
    expect(prd).toContain("privacy trade-off; MEV is bounded by the hard floor");
  });

  it("uses the solver commands verbatim", () => {
    expect(SOLVER_INIT_COMMAND).toBe("pnpm solver:init --label <name>");
    expect(SOLVER_DEV_COMMAND).toBe("pnpm solver:dev");
    expect(prd).toContain("pnpm solver:dev");
  });
});
