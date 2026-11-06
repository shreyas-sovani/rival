import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ENV_FILE = path.join(ROOT, "secrets/.env.local");

export function readEnvFile(): string | null {
  try {
    return readFileSync(ENV_FILE, "utf8");
  } catch {
    return null;
  }
}

function valueInFile(text: string, name: string): string | null {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eq = body.indexOf("=");
    if (eq < 0) continue;
    if (body.slice(0, eq).trim() !== name) continue;
    const value = body
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    return value.length > 0 ? value : null;
  }
  return null;
}

/** Process environment wins over secrets/.env.local. Never log the return value. */
export function envValue(name: string): string | null {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  const text = readEnvFile();
  if (!text) return null;
  return valueInFile(text, name);
}

export function keyStatus(name: string): "present" | "absent" {
  return envValue(name) ? "present" : "absent";
}

export function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(secret).join("[redacted]");
    const bare = secret.replace(/^0x/i, "");
    if (bare && bare !== secret) out = out.split(bare).join("[redacted]");
  }
  return out.replace(/https?:\/\/\S+/g, "[redacted-url]");
}

export function founderCommand(script: string, extra: string[] = []): string {
  const lines = [
    "BLOCKED: SEPOLIA_RPC_URL and OPERATOR_PRIVATE_KEY are not both set.",
    "Put both in the environment, or in secrets/.env.local, then run:",
    ...extra,
    `pnpm exec tsx ${script}`,
  ];
  return lines.join("\n");
}
