import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIntent, hashIntent, permit2TypedData } from "../../packages/intent/src/index.ts";
import type { Address } from "../../packages/intent/src/types.ts";
import {
  buildIntentQuery,
  countPresence,
  publishIntent,
  queryOpenIntents,
  upsertPresence,
} from "../../packages/arkiv/src/index.ts";
import {
  accountFromPrivateKey,
  createTimedArkivClients,
  createTimedReadClient,
  formatEther,
  isHex,
} from "../../packages/arkiv/src/timedClient.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(root, "secrets/.env.local");
const reportPath = resolve(root, "docs/spikes/S4.md");
const frictionPath = resolve(root, "arkiv/friction.md");

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as const;
const TOKEN_IN = "0x2222222222222222222222222222222222222222" as const;
const TOKEN_OUT = "0x3333333333333333333333333333333333333333" as const;

const ACCOUNTS = [
  ["OPERATOR_PRIVATE_KEY", "OPERATOR_ADDRESS"],
  ["HOUSE_PRIVATE_KEY", "HOUSE_ADDRESS"],
  ["SOLVER_ATLAS_PRIVATE_KEY", "SOLVER_ATLAS_ADDRESS"],
  ["SOLVER_MERIDIAN_PRIVATE_KEY", "SOLVER_MERIDIAN_ADDRESS"],
  ["SOLVER_FENIX_PRIVATE_KEY", "SOLVER_FENIX_ADDRESS"],
  ["SOLVER_VAULT_PRIVATE_KEY", "SOLVER_VAULT_ADDRESS"],
] as const;

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice("export ".length).trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length < 8) continue;
    out = out.split(secret).join("[redacted]");
    out = out.split(encodeURIComponent(secret)).join("[redacted]");
  }
  return out;
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const extra = error as Error & { shortMessage?: string; details?: string; url?: string };
    return [extra.shortMessage, extra.details, extra.url, extra.message].filter(Boolean).join(" — ");
  }
  return String(error);
}

function writeReport(body: string): void {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, body);
}

function appendFriction(bullet: string): void {
  mkdirSync(dirname(frictionPath), { recursive: true });
  if (!existsSync(frictionPath)) writeFileSync(frictionPath, "# Arkiv friction\n\n");
  appendFileSync(frictionPath, `${bullet.trim()}\n`);
}

function containsHash(value: unknown, hash: string, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof value === "string") return value.toLowerCase() === hash.toLowerCase();
  if (Array.isArray(value)) return value.some((item) => containsHash(item, hash, depth + 1));
  if (value !== null && typeof value === "object") {
    return Object.values(value).some((item) => containsHash(item, hash, depth + 1));
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function secretValues(): string[] {
  const values = [
    process.env.ARKIV_ACCESS_KEY_WRITE ?? "",
    ...(process.env.ARKIV_ACCESS_KEYS_READ ?? "").split(","),
    ...ACCOUNTS.map(([name]) => process.env[name] ?? ""),
  ];
  return values.map((value) => value.trim()).filter((value) => value.length >= 8);
}

async function main(): Promise<void> {
  if (!process.argv.includes("--check")) {
    console.error("usage: tsx scripts/spikes/s4-arkiv.ts --check");
    process.exit(1);
  }
  loadEnvFile(envPath);
  const writeKey = process.env.ARKIV_ACCESS_KEY_WRITE?.trim() ?? "";
  if (writeKey.length === 0) {
    console.log("S4 skipped: H-005 keys absent");
    writeReport(`# S4 Arkiv spike

K6: BLOCKED

\`ARKIV_ACCESS_KEY_WRITE\` is absent, so H-005 is not done. This run did not call the network.
`);
    appendFriction(
      `- ${new Date().toISOString().slice(0, 10)} — S4 did not call the network: ARKIV_ACCESS_KEY_WRITE is absent (H-005). No SDK mismatch, query grammar, or CORS behavior was observed.`,
    );
    process.exit(0);
  }

  const secrets = secretValues();
  try {
    const report = await runLive(writeKey, secrets);
    writeReport(report.markdown);
    appendFriction(report.friction);
    console.log(report.summary);
  } catch (error) {
    const message = redact(errorText(error), secrets);
    writeReport(`# S4 Arkiv spike

K6: FALLBACK

The write key is present, but the live path did not finish.

\`\`\`
${message}
\`\`\`
`);
    appendFriction(
      `- ${new Date().toISOString().slice(0, 10)} — S4 called Rabdi and stopped: ${message.replaceAll("\n", " ")}. Browser CORS was not exercised.`,
    );
    console.log(`S4 K6: FALLBACK`);
    console.log(message);
  }
}

async function runLive(writeKey: string, secrets: readonly string[]): Promise<{
  markdown: string;
  friction: string;
  summary: string;
}> {
  const readKeys = (process.env.ARKIV_ACCESS_KEYS_READ ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const lines: string[] = [];
  const friction: string[] = [];
  const stamp = new Date().toISOString();

  let funded:
    | { account: ReturnType<typeof accountFromPrivateKey>; label: string; before: bigint }
    | undefined;
  const probe = createTimedReadClient(writeKey);

  for (const [keyName, addressName] of ACCOUNTS) {
    const raw = process.env[keyName]?.trim() ?? "";
    const expected = process.env[addressName]?.trim();
    if (!isHex(raw) || raw.length !== 66) continue;
    const account = accountFromPrivateKey(raw);
    if (expected && account.address.toLowerCase() !== expected.toLowerCase()) continue;
    const before = await probe.getBalance({ address: account.address });
    if (before > 0n) {
      funded = { account, label: addressName, before };
      break;
    }
  }
  if (!funded) throw new Error("no funded Rabdi account");

  const { read, write } = createTimedArkivClients({
    readKey: writeKey,
    writeKey,
    account: funded.account,
  });

  const now = Math.floor(Date.now() / 1000);
  const pair = `s4-${now}`;
  const intent = buildIntent({
    maker: funded.account.address,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: 10n ** 18n,
    preset: "balanced",
    mode: 0,
    startTime: now,
    nonce: BigInt(now),
    hardMinOut: 1n,
    gate: 0,
  });
  const typed = permit2TypedData({
    intent,
    permit2: PERMIT2,
    settlement: SETTLEMENT,
    chainId: 11155111,
  });
  const signature = await funded.account.signTypedData({
    domain: typed.domain,
    types: typed.types,
    primaryType: typed.primaryType,
    message: typed.message,
  });
  const intentHash = hashIntent(intent, {
    name: "RivalSettlement",
    version: "1",
    chainId: 11155111,
    verifyingContract: SETTLEMENT,
  });
  const witness = {
    domain: {
      name: "RivalSettlement",
      version: "1",
      chainId: 11155111,
      verifyingContract: SETTLEMENT,
    },
    permit2: PERMIT2,
    settlement: SETTLEMENT,
    chainId: 11155111,
  } as const;

  const writeStarted = Date.now();
  const entityKey = await publishIntent(write, {
    ...witness,
    intent,
    signature,
    publisher: funded.account.address,
    pair,
  });
  const writeMs = Date.now() - writeStarted;

  let found = false;
  let attempts = 0;
  let queryMs = 0;
  const queryStarted = Date.now();
  while (attempts < 8 && Date.now() - queryStarted < 12_000) {
    attempts += 1;
    const page = await queryOpenIntents({
      client: read,
      now,
      pair,
      status: "open",
      sortDeadlineAsc: true,
    });
    if (containsHash(page, intentHash)) {
      found = true;
      break;
    }
    await sleep(1_000);
  }
  queryMs = Date.now() - queryStarted;

  const betweenQuery = buildIntentQuery({
    status: "open",
    pair,
    amountInMin: 10n ** 18n,
    amountInMax: 10n ** 18n * 10n,
    now,
  });
  let betweenOk = false;
  let betweenNote = "";
  try {
    const page = await read.query(betweenQuery, { limit: 100 });
    betweenOk = containsHash(page, intentHash);
    if (!betweenOk) betweenNote = "BETWEEN query returned no matching entity";
  } catch (error) {
    betweenNote = redact(errorText(error), secrets);
  }

  const presence = {
    solver: funded.account.address,
    ensName: "s4.solvers.rival.eth",
    pair,
    maxAmountIn: 10n ** 18n,
    strategy: "sprint",
    version: "s4",
  };
  const presenceStarted = Date.now();
  const presenceKey = await upsertPresence(write, presence);
  const presenceCreateMs = Date.now() - presenceStarted;
  await sleep(3_000);
  let extendMs = 0;
  let extendNote = "";
  let extended = false;
  try {
    const extendStarted = Date.now();
    const extendedKey = await upsertPresence(write, { ...presence, entityKey: presenceKey });
    extendMs = Date.now() - extendStarted;
    extended = extendedKey.toLowerCase() === presenceKey.toLowerCase();
    if (!extended) extendNote = "extendEntity returned a different key";
  } catch (error) {
    extendNote = redact(errorText(error), secrets);
  }

  let presenceCount = "";
  try {
    const count = await countPresence(read, pair);
    presenceCount = count.toString();
  } catch (error) {
    presenceCount = `error: ${redact(errorText(error), secrets)}`;
    friction.push(`count projection: ${presenceCount}`);
  }

  const after = await read.getBalance({ address: funded.account.address as Address });
  const spent = funded.before - after;

  const gaps: string[] = [];
  if (!found) gaps.push("open-intent query did not return the entity");
  if (!betweenOk) gaps.push(betweenNote || "u256 BETWEEN did not match");
  if (!extended) gaps.push(extendNote || "presence extend failed");
  const decision = gaps.length === 0 ? "GO" : "FALLBACK";

  lines.push(`# S4 Arkiv spike`, ``, `K6: ${decision}`, ``, `## Evidence`, ``);
  lines.push(`- When: ${stamp}`);
  lines.push(`- Network: Rabdi via Node RPC. Browser CORS was not called.`);
  lines.push(`- Read keys configured: ${readKeys.length}. This run used the write key for both clients.`);
  lines.push(`- Account: ${funded.label} ${funded.account.address}`);
  lines.push(`- Intent entity: ${entityKey}`);
  lines.push(`- Intent hash: ${intentHash}`);
  lines.push(`- Pair: ${pair}`);
  lines.push(`- Write latency: ${writeMs} ms`);
  lines.push(`- Query: ${found ? "found" : "missing"} in ${queryMs} ms across ${attempts} attempt(s)`);
  lines.push(`- u256 BETWEEN: ${betweenOk ? "matched the entity" : betweenNote}`);
  lines.push(`- Presence entity: ${presenceKey}`);
  lines.push(`- Presence create: ${presenceCreateMs} ms`);
  lines.push(`- Presence extend: ${extended ? `ok in ${extendMs} ms` : extendNote}`);
  lines.push(`- Presence count for the pair: ${presenceCount}`);
  lines.push(`- tGLM: ${formatEther(funded.before)} → ${formatEther(after)} (spent ${formatEther(spent)})`);
  lines.push(``);
  if (decision === "GO") {
    lines.push(
      `K6 is GO because the intent write was readable by the open-intent query and presence extendEntity succeeded. The amountIn BETWEEN filter also returned the entity.`,
    );
  } else {
    lines.push(`K6 is FALLBACK. What failed: ${gaps.join("; ")}.`);
    lines.push(`What still worked: write ${writeMs} ms, query ${found ? "hit" : "miss"}, extend ${extended ? "ok" : "failed"}.`);
  }
  lines.push(``);
  lines.push("Open query:");
  lines.push("");
  lines.push("```sql");
  lines.push(buildIntentQuery({ now, status: "open", pair, sortDeadlineAsc: true }));
  lines.push("```");
  lines.push("");
  lines.push("BETWEEN query:");
  lines.push("");
  lines.push("```sql");
  lines.push(betweenQuery);
  lines.push("```");
  lines.push("");

  const date = stamp.slice(0, 10);
  if (decision === "GO") {
    friction.push(
      `${date} — S4 Node RPC write (${writeMs} ms), query (${queryMs} ms, ${attempts} attempt(s)), u256 BETWEEN matched, presence extendEntity (${extendMs} ms). tGLM spent ${formatEther(spent)}. No query-grammar rejection. Browser CORS was not exercised.`,
    );
  } else {
    friction.push(`${date} — S4 partial: ${gaps.join("; ")}. Write ${writeMs} ms. Browser CORS was not exercised.`);
  }
  if (attempts > 1 && found) {
    friction.push(`${date} — Intent was not visible on the first query; it appeared after ${attempts} attempts (${queryMs} ms).`);
  }

  return {
    markdown: `${lines.join("\n")}\n`,
    friction: friction.map((item) => `- ${item}`).join("\n") + "\n",
    summary: [
      `S4 K6: ${decision}`,
      `entity ${entityKey}`,
      `write ${writeMs} ms`,
      `query ${found ? "hit" : "miss"} ${queryMs} ms`,
      `between ${betweenOk ? "hit" : "miss"}`,
      `extend ${extended ? "ok" : "fail"} ${extendMs} ms`,
      `tGLM spent ${formatEther(spent)}`,
    ].join("\n"),
  };
}

await main();
