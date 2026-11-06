import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { castCall, castSend, castWord } from "./ens-cast.ts";
import {
  AGENT_TEXT_KEYS,
  ALL_ROLES,
  ETH_REGISTRY,
  NAMES_ROOT_BITMAP,
  PARENT_NAME_ROLES,
  PERMISSIONED_RESOLVER_IMPL,
  PROTOCOL_TEXT_KEYS,
  RESOLVER_ADMIN_ROLES,
  SITE_ORIGIN,
  USER_REGISTRY_IMPL,
  VERIFIABLE_FACTORY,
  ZERO_ADDRESS,
} from "./ens-constants.ts";
import { dnsEncode } from "./ens-dns.ts";
import { ROOT, envValue, founderCommand, keyStatus } from "./ens-env.ts";

/** Thrown when `--broadcast` is set and ENS_BOOTSTRAP_BROADCAST is not "1". */
export class BroadcastDisabled extends Error {
  constructor() {
    super("BroadcastDisabled");
    this.name = "BroadcastDisabled";
  }
}

interface Deployment {
  names?: string;
  ens?: { parentLabel?: string; solversRegistry?: string };
  solvers?: Array<{ label?: string; address?: string; strategy?: string }>;
}

interface Chain {
  rpc: string;
  key: string;
  secrets: string[];
  operator: string;
}

export function dryRunText(): string {
  return [
    "ENS bootstrap",
    "Buys nothing. Parent registration is scripts/ens-register-parent.ts.",
    `SEPOLIA_RPC_URL: ${keyStatus("SEPOLIA_RPC_URL")}`,
    `OPERATOR_PRIVATE_KEY: ${keyStatus("OPERATOR_PRIVATE_KEY")}`,
    `ENS_PARENT_LABEL: ${keyStatus("ENS_PARENT_LABEL")}`,
    "",
    "After the parent exists, --broadcast does all of the following:",
    "1. Deploy a UserRegistry proxy (canonical UserRegistryImpl via VerifiableFactory) and setParent to the ETHRegistry label.",
    "2. setSubregistry on <parent>.eth so that registry holds *.parent.eth.",
    "3. register solvers on that registry with subregistry = the deployed PermissionedRegistry (ens.solversRegistry).",
    "4. Deploy a PermissionedResolver proxy. Root roles are ROLE_SET_TEXT_ADMIN plus upgrade, not ROLE_SET_TEXT.",
    "5. setResolver on each solver label in the solvers registry when the operator holds ROLE_SET_RESOLVER. Otherwise print the cast command for the registry's root admin.",
    "6. Grant solver-editable keys (description, url, avatar, agent-context, agent-endpoint[web], agent-registration[11155111]) with grantSetterRoles, then setText(bytes,string,string).",
    "7. Grant com.rival.fills, com.rival.makers, com.rival.avgImprovementBps, and com.rival.lastFill only to RivalNames. Snapshot protocolRecord into those keys, then revokeRoles the operator on those keys.",
    "8. RivalNames root roles stay ROLE_REGISTRAR | ROLE_RENEW | ROLE_UNREGISTER (0x11001). This script does not grant transfer, set-resolver, or admin roles to RivalNames.",
    "",
    "com.rival.* setText from any account other than RivalNames reverts EACUnauthorizedAccountRoles.",
    "The deployed RivalNames resolver immutable is address(0). Its syncRecords writes storage. The source calls setText only when that immutable is non-zero, which requires a new RivalNames deployment this script does not perform.",
    "",
    founderCommand("scripts/ens-bootstrap.ts --broadcast", ["ENS_BOOTSTRAP_BROADCAST=1"]),
    "",
    "Optional rerun overrides, if deployProxy says the salt is used: ENS_USER_REGISTRY, ENS_RESOLVER.",
    `# names root bitmap ${NAMES_ROOT_BITMAP.toString(16)}`,
    `# resolver admin bitmap ${RESOLVER_ADMIN_ROLES.toString(16)}`,
  ].join("\n");
}

function loadDeployment(): Deployment {
  return JSON.parse(readFileSync(path.join(ROOT, "deployments/sepolia.json"), "utf8")) as Deployment;
}

function parentLabel(deployment: Deployment): string {
  return envValue("ENS_PARENT_LABEL") || deployment.ens?.parentLabel || "rival";
}

function requireAddress(value: string | undefined, label: string): string {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value) || value.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`BLOCKED: ${label} is missing from deployments/sepolia.json`);
  }
  return value;
}

function send(chain: Chain, args: string[]): string {
  const hash = castSend([...args, "--rpc-url", chain.rpc, "--private-key", chain.key], chain.secrets);
  console.log(`${args[1] ?? "tx"} ${hash}`);
  return hash;
}

function call(chain: Chain, args: string[]): string {
  return castCall([...args, "--rpc-url", chain.rpc], chain.secrets);
}

function word(chain: Chain, args: string[]): string {
  return castWord(args, chain.secrets);
}

function labelHash(chain: Chain, label: string): string {
  return word(chain, ["keccak", label]);
}

function deployProxy(chain: Chain, implementation: string, saltLabel: string, calldata: string, overrideName: string): string {
  const override = envValue(overrideName);
  if (override && /^0x[0-9a-fA-F]{40}$/.test(override)) {
    console.log(`${overrideName} override ${override}`);
    return override;
  }
  const salt = word(chain, ["keccak", saltLabel]);
  const predicted = call(chain, [
    VERIFIABLE_FACTORY,
    "deployProxy(address,uint256,bytes)(address)",
    implementation,
    salt,
    calldata,
    "--from",
    chain.operator,
  ]).split(/\s+/)[0];
  if (!predicted || !/^0x[0-9a-fA-F]{40}$/.test(predicted)) {
    throw new Error(`BLOCKED: deployProxy did not return an address for ${saltLabel}`);
  }
  send(chain, [VERIFIABLE_FACTORY, "deployProxy(address,uint256,bytes)", implementation, salt, calldata]);
  console.log(`${saltLabel} ${predicted}`);
  return predicted;
}

function setText(chain: Chain, resolver: string, dnsName: string, key: string, value: string): void {
  send(chain, [resolver, "setText(bytes,string,string)", dnsName, key, value]);
}

function setterCalldata(chain: Chain, dnsName: string, key: string): string {
  return word(chain, ["calldata", "setText(bytes,string,string)", dnsName, key, "0"]);
}

const ROLE_SET_TEXT = 1n << 4n;

function grantText(chain: Chain, resolver: string, dnsName: string, key: string, account: string): void {
  send(chain, [resolver, "grantSetterRoles(bytes,address)", setterCalldata(chain, dnsName, key), account]);
}

function revokeText(chain: Chain, resolver: string, key: string, account: string): void {
  const resource = word(chain, ["keccak", key]);
  send(chain, [resolver, "revokeRoles(uint256,uint256,address)", resource, ROLE_SET_TEXT.toString(), account]);
}

function tryStep(label: string, action: () => void): boolean {
  try {
    action();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`BLOCKED: ${label}: ${message}`);
    return false;
  }
}

function broadcast(): number {
  const rpc = envValue("SEPOLIA_RPC_URL");
  const key = envValue("OPERATOR_PRIVATE_KEY");
  if (!rpc || !key) {
    console.log(dryRunText());
    return 0;
  }
  const secrets = [rpc, key];
  const deployment = loadDeployment();
  const parent = parentLabel(deployment);
  const solversRegistry = requireAddress(deployment.ens?.solversRegistry, "ens.solversRegistry");
  const names = requireAddress(deployment.names, "names");
  const chain: Chain = {
    rpc,
    key,
    secrets,
    operator: word({ rpc, key, secrets, operator: ZERO_ADDRESS }, ["wallet", "address", "--private-key", key]),
  };
  console.log(`operator ${chain.operator}`);
  console.log(`parent ${parent}.eth`);

  const owner = call(chain, [ETH_REGISTRY, "getOwner(uint256)(address)", labelHash(chain, parent)]).split(/\s+/)[0];
  console.log(`parent owner ${owner ?? ZERO_ADDRESS}`);
  if (!owner || owner.toLowerCase() !== chain.operator.toLowerCase()) {
    console.error(
      "BLOCKED: the operator does not own the parent. Run scripts/ens-register-parent.ts first. This script does not register a .eth name.",
    );
    return 1;
  }

  let blocked = false;
  const userInit = word(chain, [
    "calldata",
    "initialize((address,uint256)[])",
    `[(${chain.operator},${BigInt(ALL_ROLES).toString()})]`,
  ]);
  const userRegistry = deployProxy(
    chain,
    USER_REGISTRY_IMPL,
    `rival-user-registry-${parent}-v1`,
    userInit,
    "ENS_USER_REGISTRY",
  );
  tryStep("setParent on the user registry", () => {
    send(chain, [userRegistry, "setParent(address,string)", ETH_REGISTRY, parent]);
  });

  const existingSub = call(chain, [ETH_REGISTRY, "getSubregistry(string)(address)", parent]).split(/\s+/)[0];
  if (existingSub?.toLowerCase() === userRegistry.toLowerCase()) {
    console.log(`subregistry already ${userRegistry}`);
  } else {
    blocked =
      !tryStep("setSubregistry on the parent", () => {
        send(chain, [ETH_REGISTRY, "setSubregistry(uint256,address)", labelHash(chain, parent), userRegistry]);
      }) || blocked;
  }

  const resolverInit = word(chain, [
    "calldata",
    "initialize((address,uint256)[],bytes[])",
    `[(${chain.operator},${RESOLVER_ADMIN_ROLES.toString()})]`,
    "[]",
  ]);
  const resolver = deployProxy(
    chain,
    PERMISSIONED_RESOLVER_IMPL,
    `rival-permissioned-resolver-${parent}-v1`,
    resolverInit,
    "ENS_RESOLVER",
  );

  const solversSub = call(chain, [userRegistry, "getSubregistry(string)(address)", "solvers"]).split(/\s+/)[0];
  if (solversSub?.toLowerCase() === solversRegistry.toLowerCase()) {
    console.log(`solvers subregistry already ${solversRegistry}`);
  } else if (solversSub && solversSub.toLowerCase() !== ZERO_ADDRESS) {
    blocked =
      !tryStep("point solvers at the deployed registry", () => {
        send(chain, [userRegistry, "setSubregistry(uint256,address)", labelHash(chain, "solvers"), solversRegistry]);
      }) || blocked;
  } else {
    const expiry = BigInt(word(chain, ["block", "latest", "--rpc-url", chain.rpc, "-f", "timestamp"])) + 365n * 24n * 60n * 60n;
    blocked =
      !tryStep("register solvers", () => {
        send(chain, [
          userRegistry,
          "register(string,address,address,address,uint256,uint64)",
          "solvers",
          chain.operator,
          solversRegistry,
          resolver,
          PARENT_NAME_ROLES.toString(),
          expiry.toString(),
        ]);
      }) || blocked;
  }

  tryStep("setParent on the solvers registry", () => {
    send(chain, [solversRegistry, "setParent(address,string)", userRegistry, "solvers"]);
  });

  const solvers = deployment.solvers ?? [];
  for (const solver of solvers) {
    if (!solver.label || !solver.address) continue;
    const full = `${solver.label}.solvers.${parent}.eth`;
    const dnsName = dnsEncode(full);
    const currentResolver = call(chain, [solversRegistry, "getResolver(string)(address)", solver.label]).split(/\s+/)[0];
    if (currentResolver?.toLowerCase() !== resolver.toLowerCase()) {
      const ok = tryStep(`setResolver ${solver.label}`, () => {
        send(chain, [solversRegistry, "setResolver(uint256,address)", labelHash(chain, solver.label!), resolver]);
      });
      if (!ok) {
        blocked = true;
        console.error(
          `BLOCKED: setResolver(${solver.label}) needs root ROLE_SET_RESOLVER on ${solversRegistry}. The deployer that holds ALL_ROLES runs: cast send ${solversRegistry} "setResolver(uint256,address)" ${labelHash(chain, solver.label)} ${resolver} --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY"`,
        );
      }
    }

    const strategy = solver.strategy ?? "custom";
    const agentValues: Record<string, string> = {
      description: `Rival solver ${solver.label} (${strategy}).`,
      url: `${SITE_ORIGIN}/solvers`,
      avatar: "",
      "agent-context": `Rival ${strategy} solver ${solver.label}. Fills tWETH/tUSDC intents under the signed curve.`,
      "agent-endpoint[web]": `${SITE_ORIGIN}/solvers`,
      "agent-registration[11155111]": solver.address,
    };
    for (const key of AGENT_TEXT_KEYS) {
      tryStep(`grant ${key} to ${solver.label}`, () => {
        grantText(chain, resolver, dnsName, key, solver.address!);
        grantText(chain, resolver, dnsName, key, chain.operator);
      });
      const value = agentValues[key] ?? "";
      if (value.length > 0) {
        tryStep(`setText ${full} ${key}`, () => {
          setText(chain, resolver, dnsName, key, value);
        });
      }
    }

    const record = call(chain, [
      names,
      "protocolRecord(address)(uint64,uint64,int256,uint64)",
      solver.address,
    ]);
    const parts = record.split(/\s+/);
    const fills = parts[0] ?? "0";
    const makers = parts[1] ?? "0";
    const avg = parts[2] ?? "0";
    const lastFill = parts[3] ?? "0";
    const protocolValues: Record<string, string> = {
      "com.rival.fills": fills,
      "com.rival.makers": makers,
      "com.rival.avgImprovementBps": avg,
      "com.rival.lastFill": lastFill,
    };
    for (const key of PROTOCOL_TEXT_KEYS) {
      tryStep(`grant ${key} to RivalNames`, () => {
        grantText(chain, resolver, dnsName, key, names);
        grantText(chain, resolver, dnsName, key, chain.operator);
      });
      tryStep(`snapshot ${key}`, () => {
        setText(chain, resolver, dnsName, key, protocolValues[key] ?? "0");
      });
      tryStep(`revoke operator ${key}`, () => {
        revokeText(chain, resolver, key, chain.operator);
      });
    }
  }

  const liveRoles = call(chain, [
    solversRegistry,
    "roles(uint256,address)(uint256)",
    "0",
    names,
  ]).split(/\s+/)[0];
  console.log(`RivalNames roles(0) ${liveRoles ?? "unread"} expected ${NAMES_ROOT_BITMAP.toString()}`);
  if (blocked) {
    console.error("BLOCKED: one or more bootstrap steps failed. Transaction hashes above are the ones that landed.");
    return 1;
  }
  console.log(`wired solvers.${parent}.eth -> ${solversRegistry}`);
  console.log(`resolver ${resolver}`);
  return 0;
}

export function bootstrap(argv: string[]): number {
  if (argv.includes("--broadcast")) {
    if (process.env.ENS_BOOTSTRAP_BROADCAST !== "1") throw new BroadcastDisabled();
    return broadcast();
  }
  console.log(dryRunText());
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
  try {
    process.exit(bootstrap(process.argv.slice(2)));
  } catch (error) {
    if (error instanceof BroadcastDisabled) {
      console.error("BroadcastDisabled");
      process.exit(1);
    }
    console.error(error instanceof Error ? error.message : "bootstrap failed");
    process.exit(1);
  }
}
