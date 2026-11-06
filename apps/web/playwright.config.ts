import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");
const port = 4173;
const localBaseURL = `http://127.0.0.1:${port}`;
const baseURL = process.env.E2E_BASE_URL ?? localBaseURL;

const outDir = path.join(appDir, "out");
const indexHtml = path.join(outDir, "index.html");
const serveBin = path.join(appDir, "node_modules/.bin/serve");
const serveConfig = path.join(appDir, "e2e/support/serve.json");

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

// `next start` does not serve `output: "export"`. Build the static site when it is missing, then serve `out`.
const command = [
  `if [ ! -f ${quote(indexHtml)} ]; then pnpm web:build; fi`,
  `${quote(serveBin)} ${quote(outDir)} -c ${quote(serveConfig)} -l tcp://127.0.0.1:${port} --no-clipboard --no-port-switching`,
].join(" && ");

export default defineConfig({
  testDir: path.join(appDir, "e2e"),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    storageState: { cookies: [], origins: [] },
    trace: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command,
    cwd: repoRoot,
    url: localBaseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...process.env,
      NO_UPDATE_CHECK: "1",
    },
  },
});
