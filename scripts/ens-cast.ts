import { spawnSync } from "node:child_process";

import { redact } from "./ens-env.ts";

export function sleepMs(ms: number): void {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function runCast(args: string[], secrets: string[], timeoutMs = 180_000): string {
  const result = spawnSync("cast", args, { encoding: "utf8", timeout: timeoutMs });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if ((result.status ?? 1) !== 0) {
    const detail = redact(`${stderr}\n${stdout}`, secrets).trim().slice(0, 800);
    throw new Error(detail || "cast failed");
  }
  return stdout.trim();
}

export function castCall(args: string[], secrets: string[]): string {
  return runCast(["call", ...args], secrets);
}

export function castSend(args: string[], secrets: string[]): string {
  const output = runCast(["send", "--json", "--timeout", "180", ...args], secrets);
  return transactionHash(output, secrets);
}

function transactionHash(output: string, secrets: string[]): string {
  const safe = redact(output, secrets);
  try {
    const parsed = JSON.parse(output) as { transactionHash?: string };
    if (parsed.transactionHash && /^0x[0-9a-fA-F]{64}$/.test(parsed.transactionHash)) {
      return parsed.transactionHash;
    }
  } catch {
    // cast sometimes prints a receipt object after a log line.
  }
  const match = safe.match(/"transactionHash"\s*:\s*"(0x[0-9a-fA-F]{64})"/);
  if (match?.[1]) return match[1];
  throw new Error("cast send did not return a transaction hash");
}

/** `cast` prints uints as `8e6` or `[8e6]`. Both are exact integers here. */
export function parseCastUint(word: string | undefined): bigint {
  const trimmed = (word ?? "").trim().replace(/^\[/, "").replace(/\]$/, "");
  if (/^\d+$/.test(trimmed)) return BigInt(trimmed);
  const sci = /^(\d+)(?:\.(\d+))?e\+?(\d+)$/i.exec(trimmed);
  if (!sci) throw new Error(`not a uint: ${trimmed}`);
  const whole = sci[1] ?? "0";
  const frac = sci[2] ?? "";
  const exp = Number(sci[3]);
  const zeros = exp - frac.length;
  if (!Number.isInteger(exp) || zeros < 0) throw new Error(`not an integer: ${trimmed}`);
  return BigInt(whole + frac + "0".repeat(zeros));
}

export function castWord(args: string[], secrets: string[]): string {
  const output = runCast(args, secrets);
  const token = output.split(/\s+/)[0];
  if (!token) throw new Error("cast returned empty");
  return token;
}
