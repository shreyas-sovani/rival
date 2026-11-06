#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./axe-run.ts", import.meta.url));
const result = spawnSync(process.execPath, ["--import", "tsx", script], { stdio: "inherit" });
process.exit(result.status ?? 1);
