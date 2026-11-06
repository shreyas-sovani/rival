import { readFileSync, writeFileSync } from "node:fs";

const REQUIRED = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "frame-ancestors 'none'",
];

const ENV_HOSTS = ["NEXT_PUBLIC_SEPOLIA_RPCS", "NEXT_PUBLIC_RABDI_RPC", "NEXT_PUBLIC_RUNNER_URL"];

function hostOf(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    return null;
  }
}

export function hostsFromEnv(env) {
  const hosts = [];
  for (const name of ENV_HOSTS) {
    const raw = env[name];
    if (!raw) continue;
    for (const part of raw.split(/[\s,]+/)) {
      const host = hostOf(part);
      if (host && !hosts.includes(host)) hosts.push(host);
    }
  }
  return hosts;
}

function headerMap(vercel) {
  const block = vercel.headers?.find((entry) => entry.source === "/(.*)");
  if (!block) throw new Error("missing headers for /(*)");
  return new Map(block.headers.map((header) => [header.key, header.value]));
}

function connectSrc(hosts) {
  return ["'self'", ...hosts].join(" ");
}

export function buildCsp(hosts) {
  return `${CSP_DIRECTIVES.join("; ")}; connect-src ${connectSrc(hosts)}`.replace(
    "frame-ancestors 'none'",
    `connect-src ${connectSrc(hosts)}; frame-ancestors 'none'`,
  );
}

function assertNoWildcard(value) {
  const tokens = value.split(/[;\s]+/).filter(Boolean);
  if (tokens.includes("*") || tokens.some((token) => token.includes("*"))) {
    throw new Error(`wildcard source in header: ${value}`);
  }
}

export function checkHeaders(vercelPath, hostsPath) {
  const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));
  const listed = JSON.parse(readFileSync(hostsPath, "utf8"));
  if (!Array.isArray(listed.hosts) || listed.hosts.some((host) => typeof host !== "string")) {
    throw new Error("connect-src hosts must be a string array");
  }
  if (vercel.cleanUrls !== true) throw new Error("cleanUrls must be true");
  const headers = headerMap(vercel);
  if (headers.has("Set-Cookie")) throw new Error("Set-Cookie is not allowed");
  for (const [key, value] of Object.entries(REQUIRED)) {
    if (headers.get(key) !== value) throw new Error(`${key} missing or wrong`);
  }
  const csp = headers.get("Content-Security-Policy");
  if (!csp) throw new Error("Content-Security-Policy missing");
  assertNoWildcard(csp);
  for (const directive of CSP_DIRECTIVES) {
    if (!csp.includes(directive)) throw new Error(`CSP missing ${directive}`);
  }
  const expected = `connect-src ${connectSrc(listed.hosts)}`;
  if (!csp.includes(expected)) throw new Error(`CSP connect-src does not match ${hostsPath}`);
  return "headers ok";
}

function writeGenerated(vercelPath, hostsPath, env) {
  const hosts = hostsFromEnv(env);
  const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));
  const headers = headerMap(vercel);
  headers.set("Content-Security-Policy", buildCsp(hosts));
  const block = vercel.headers.find((entry) => entry.source === "/(.*)");
  block.headers = [...headers.entries()].map(([key, value]) => ({ key, value }));
  writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);
  writeFileSync(hostsPath, `${JSON.stringify({ hosts }, null, 2)}\n`);
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const vercelPath = process.argv[2];
  if (!vercelPath) {
    console.error("usage: node scripts/check-headers.mjs <vercel.json> [--write]");
    process.exit(1);
  }
  const hostsPath = new URL("../apps/web/connect-src.json", import.meta.url);
  if (process.argv.includes("--write")) writeGenerated(vercelPath, hostsPath, process.env);
  try {
    console.log(checkHeaders(vercelPath, hostsPath));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "header check failed");
    process.exit(1);
  }
}
