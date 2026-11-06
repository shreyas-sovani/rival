import { Writable } from "node:stream";
import pino from "pino";
import { runnerSecretNames } from "./config.ts";

const CENSOR = "[Redacted]";
const SECRET_TEXT = /0x[a-fA-F0-9]{130}|0x[a-fA-F0-9]{64}/g;

const secretNames = new Set(runnerSecretNames());

function sensitiveName(name: string): boolean {
  if (secretNames.has(name)) return true;
  if (/signature/i.test(name)) return true;
  if (/private[_-]?key/i.test(name)) return true;
  return false;
}

export function redactString(value: string): string {
  return value.replace(SECRET_TEXT, CENSOR);
}

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = sensitiveName(key) ? CENSOR : redactSecrets(item);
  }
  return out;
}

export interface Logger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export function createLogger(destination: Writable = process.stdout): Logger {
  const paths = [
    ...runnerSecretNames(),
    "privateKey",
    "private_key",
    "signature",
    "*.privateKey",
    "*.private_key",
    "*.signature",
    "*.*.privateKey",
    "*.*.private_key",
    "*.*.signature",
  ];
  const log = pino({ level: "info", redact: { paths, censor: CENSOR } }, destination);
  const write = (level: "info" | "warn" | "error", input: unknown, msg?: string): void => {
    const obj =
      input !== null && typeof input === "object" && !Array.isArray(input)
        ? (redactSecrets(input) as Record<string, unknown>)
        : { value: redactSecrets(input) };
    if (msg === undefined) log[level](obj);
    else log[level](obj, redactString(msg));
  };
  return {
    info: (obj, msg) => write("info", obj, msg),
    warn: (obj, msg) => write("warn", obj, msg),
    error: (obj, msg) => write("error", obj, msg),
  };
}

export const logger = createLogger();
