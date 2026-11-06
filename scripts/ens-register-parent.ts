import { randomBytes } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { castCall, castSend, castWord, parseCastUint, sleepMs } from "./ens-cast.ts";
import {
  ETH_REGISTRAR,
  ETH_REGISTRY,
  MOCK_USDC,
  PARENT_LABEL_CANDIDATES,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from "./ens-constants.ts";
import { chooseLabel, dnsEncode } from "./ens-dns.ts";
import { ROOT, envValue, founderCommand, keyStatus, redact } from "./ens-env.ts";

export { chooseLabel, PARENT_LABEL_CANDIDATES };

const YEAR_SECONDS = 365n * 24n * 60n * 60n;

export function registerPlan(): string {
  return [
    "ENS parent registration (Sepolia ETHRegistrar)",
    `ETHRegistrar ${ETH_REGISTRAR}`,
    `ETHRegistry ${ETH_REGISTRY}`,
    `MockUSDC ${MOCK_USDC} (fee token, open mint)`,
    `Label order: ${PARENT_LABEL_CANDIDATES.join(" -> ")}`,
    `SEPOLIA_RPC_URL: ${keyStatus("SEPOLIA_RPC_URL")}`,
    `OPERATOR_PRIVATE_KEY: ${keyStatus("OPERATOR_PRIVATE_KEY")}`,
    "",
    "Steps when both values are set:",
    "1. mint MockUSDC to the operator",
    "2. approve the ETHRegistrar for the quoted register price",
    "3. commit(makeCommitment(...))",
    "4. wait MIN_COMMITMENT_AGE",
    "5. register the first available label from the list above",
    "If the operator already owns a candidate, the script prints that label and does not register another.",
    "",
    founderCommand("scripts/ens-register-parent.ts"),
    "",
    "This process prints transaction hashes and ENS_PARENT_LABEL. It does not print the operator key.",
  ].join("\n");
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function labelHash(label: string, secrets: string[]): string {
  return castWord(["keccak", label], secrets);
}

function ownerOfLabel(label: string, rpc: string, secrets: string[]): string {
  const hash = labelHash(label, secrets);
  const owner = castCall(
    [ETH_REGISTRY, "getOwner(uint256)(address)", hash, "--rpc-url", rpc],
    secrets,
  );
  return owner.split(/\s+/)[0] ?? ZERO_ADDRESS;
}

function isAvailable(label: string, rpc: string, secrets: string[]): boolean {
  const raw = castCall(
    [ETH_REGISTRAR, "isAvailable(string)(bool)", label, "--rpc-url", rpc],
    secrets,
  );
  return raw.split(/\s+/)[0] === "true";
}

function uintCall(signature: string, rpc: string, secrets: string[]): bigint {
  const raw = castCall([ETH_REGISTRAR, signature, "--rpc-url", rpc], secrets);
  return parseCastUint(raw.split(/\s+/)[0]);
}

export function registerParent(): number {
  const rpc = envValue("SEPOLIA_RPC_URL");
  const key = envValue("OPERATOR_PRIVATE_KEY");
  if (!rpc || !key) {
    console.log(registerPlan());
    return 0;
  }
  const secrets = [rpc, key];
  try {
    return broadcast(rpc, key, secrets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "registration failed";
    console.error(redact(message, secrets));
    console.error("BLOCKED: parent registration did not finish.");
    return 1;
  }
}

function broadcast(rpc: string, key: string, secrets: string[]): number {
  const operator = castWord(["wallet", "address", "--private-key", key], secrets);
  console.log(`operator ${operator}`);
  const owned: string[] = [];
  const available: boolean[] = [];
  for (const label of PARENT_LABEL_CANDIDATES) {
    const owner = ownerOfLabel(label, rpc, secrets);
    if (sameAddress(owner, operator)) owned.push(label);
    available.push(isAvailable(label, rpc, secrets));
    console.log(`${label}.eth owner ${owner} available ${available[available.length - 1]}`);
  }
  if (owned[0]) {
    console.log(`ENS_PARENT_LABEL=${owned[0]}`);
    console.log(`${owned[0]}.eth is already owned by the operator. No registration transaction.`);
    console.log(`node check: cast namehash ${owned[0]}.eth`);
    console.log(`dns ${dnsEncode(`${owned[0]}.eth`)}`);
    return 0;
  }
  const label = chooseLabel(PARENT_LABEL_CANDIDATES, available);
  if (!label) {
    console.error("BLOCKED: rival, rivalx, and rivalmarket are all unavailable and not owned by the operator.");
    return 1;
  }

  const minDuration = uintCall("MIN_REGISTER_DURATION()(uint64)", rpc, secrets);
  const duration = minDuration > YEAR_SECONDS ? minDuration : YEAR_SECONDS;
  const priceRaw = castCall(
    [
      ETH_REGISTRAR,
      "getRegisterPrice(string,uint64,address)(uint256,uint256)",
      label,
      duration.toString(),
      MOCK_USDC,
      "--rpc-url",
      rpc,
    ],
    secrets,
  );
  const [baseWord, premiumWord] = priceRaw.split(/\s+/);
  const base = parseCastUint(baseWord);
  const premium = parseCastUint(premiumWord);
  const cost = base + premium;
  const mintAmount = cost > 0n ? cost : 1_000_000n;
  console.log(`label ${label} duration ${duration.toString()} price ${cost.toString()}`);

  const mintTx = castSend(
    [MOCK_USDC, "mint(address,uint256)", operator, mintAmount.toString(), "--rpc-url", rpc, "--private-key", key],
    secrets,
  );
  console.log(`mint ${mintTx}`);

  if (cost > 0n) {
    const approveTx = castSend(
      [MOCK_USDC, "approve(address,uint256)", ETH_REGISTRAR, cost.toString(), "--rpc-url", rpc, "--private-key", key],
      secrets,
    );
    console.log(`approve ${approveTx}`);
  }

  const secret = `0x${randomBytes(32).toString("hex")}`;
  secrets.push(secret);
  const commitment = castCall(
    [
      ETH_REGISTRAR,
      "makeCommitment(string,address,bytes32,address,address,uint64,bytes32)(bytes32)",
      label,
      operator,
      secret,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      duration.toString(),
      ZERO_BYTES32,
      "--rpc-url",
      rpc,
    ],
    secrets,
  ).split(/\s+/)[0];
  if (!commitment) throw new Error("makeCommitment returned empty");
  const commitTx = castSend(
    [ETH_REGISTRAR, "commit(bytes32)", commitment, "--rpc-url", rpc, "--private-key", key],
    secrets,
  );
  console.log(`commit ${commitTx}`);

  const minAge = Number(uintCall("MIN_COMMITMENT_AGE()(uint64)", rpc, secrets));
  const waitSeconds = Number.isFinite(minAge) && minAge > 0 ? minAge + 5 : 5;
  console.log(`waiting ${waitSeconds}s for MIN_COMMITMENT_AGE`);
  sleepMs(waitSeconds * 1000);

  const registerTx = castSend(
    [
      ETH_REGISTRAR,
      "register(string,address,bytes32,address,address,uint64,address,bytes32)",
      label,
      operator,
      secret,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      duration.toString(),
      MOCK_USDC,
      ZERO_BYTES32,
      "--rpc-url",
      rpc,
      "--private-key",
      key,
    ],
    secrets,
  );
  console.log(`register ${registerTx}`);
  let owner = ZERO_ADDRESS;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    owner = ownerOfLabel(label, rpc, secrets);
    if (sameAddress(owner, operator)) break;
    sleepMs(5_000);
  }
  console.log(`ENS_PARENT_LABEL=${label}`);
  console.log(`owner ${owner}`);
  if (!sameAddress(owner, operator)) {
    console.error("BLOCKED: register transaction landed but getOwner is not the operator.");
    return 1;
  }
  console.log(`Write ENS_PARENT_LABEL=${label} into secrets/.env.local`);
  const deployment = JSON.parse(readFileSync(path.join(ROOT, "deployments/sepolia.json"), "utf8")) as {
    ens?: { parentLabel?: string };
  };
  if (deployment.ens?.parentLabel && deployment.ens.parentLabel !== label) {
    console.log(
      `deployments/sepolia.json ens.parentLabel is ${deployment.ens.parentLabel}. Update that field to ${label} after this broadcast.`,
    );
  }
  return 0;
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  }
}

if (invokedDirectly()) {
  process.exit(registerParent());
}
