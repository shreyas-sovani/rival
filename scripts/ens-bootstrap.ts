import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Thrown when `--broadcast` is set and ENS_BOOTSTRAP_BROADCAST is not "1". */
export class BroadcastDisabled extends Error {
  constructor() {
    super("BroadcastDisabled");
    this.name = "BroadcastDisabled";
  }
}

const ALL_ROLES = "0x1111111111111111111111111111111111111111111111111111111111111111";
const GRANT_BITMAP = "0x11001";

function keyStatus(text: string | null, name: string): "present" | "absent" {
  if (text === null) return "absent";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    if (!body.startsWith(`${name}=`)) continue;
    const value = body.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
    return value.length > 0 ? "present" : "absent";
  }
  return "absent";
}

function envFileText(): string | null {
  try {
    return readFileSync(new URL("../secrets/.env.local", import.meta.url), "utf8");
  } catch {
    return null;
  }
}

function printDryRun(): void {
  const envText = envFileText();
  const lines = [
    "ENS bootstrap dry-run",
    "H-006 waived (docs/spikes/S3.md): do not buy rival.eth and do not register a .eth parent.",
    "",
    "secrets/.env.local",
    `ENS_PARENT_LABEL: ${keyStatus(envText, "ENS_PARENT_LABEL")}`,
    `SEPOLIA_RPC_URL: ${keyStatus(envText, "SEPOLIA_RPC_URL")}`,
    "",
    "Planned steps:",
    "1. Deploy our own PermissionedRegistry (the solvers registry). The constructor is (labelStore, rootAccount, roleBitmap). rootAccount is the deployer. roleBitmap is EACBaseRolesLib.ALL_ROLES so that account can call grantRootRoles. The label store is MockLabelStore from contracts/test/ens/EnsHarness.sol, because the real LabelStore imports NameCoder from the empty ens-contracts submodule.",
    "2. Grant RivalNames root ROLE_REGISTRAR (1<<0), ROLE_RENEW (1<<16), and ROLE_UNREGISTER (1<<12) via grantRootRoles. That bitmap is 0x11001. No other root roles for RivalNames. Resolver stays address(0) until PermissionedResolver compiles.",
    "3. Do not register a .eth parent. Do not call ETHRegistrar. Do not spend ETH on rival.eth.",
    "",
    "Operator authority: the constructor leaves ALL_ROLES with the deployer. This pass does not renounce that bitmap. RivalNames receives only the three roles above. The deployer has no authority over settlement or funds. specs/ens-roles.expected.json names holder RivalNames on resource 0 (ROOT_RESOURCE) until a deployed address exists.",
    "",
    "This process does not broadcast, open a websocket, or fork.",
    "",
    "# commands below are comments in this output. They are not executed.",
    "# ROLE_REGISTRAR  = 1 << 0  = 0x1",
    "# ROLE_UNREGISTER = 1 << 12 = 0x1000",
    "# ROLE_RENEW      = 1 << 16 = 0x10000",
    `# grant bitmap    = (1<<0) | (1<<12) | (1<<16) = ${GRANT_BITMAP}`,
    `# ALL_ROLES       = ${ALL_ROLES}`,
    "#",
    "# cd contracts && forge create test/ens/EnsHarness.sol:MockLabelStore --rpc-url \"$SEPOLIA_RPC_URL\" --private-key \"$DEPLOYER_PRIVATE_KEY\"",
    `# cd contracts && forge create lib/contracts-v2/contracts/src/registry/PermissionedRegistry.sol:PermissionedRegistry --constructor-args <LABEL_STORE> <DEPLOYER> ${ALL_ROLES} --rpc-url \"$SEPOLIA_RPC_URL\" --private-key \"$DEPLOYER_PRIVATE_KEY\"`,
    `# cast send <SOLVERS_REGISTRY> "grantRootRoles(uint256,address)" ${GRANT_BITMAP} <RIVAL_NAMES> --rpc-url \"$SEPOLIA_RPC_URL\" --private-key \"$DEPLOYER_PRIVATE_KEY\"`,
    "# cast call <SOLVERS_REGISTRY> \"roles(uint256,address)(uint256)\" 0 <RIVAL_NAMES> --rpc-url \"$SEPOLIA_RPC_URL\"",
    "# not run: any ETHRegistrar register of a .eth parent, including rival.eth",
  ];
  console.log(lines.join("\n"));
}

export function bootstrap(argv: string[]): number {
  if (argv.includes("--broadcast")) {
    if (process.env.ENS_BOOTSTRAP_BROADCAST !== "1") throw new BroadcastDisabled();
    throw new Error("ENS bootstrap broadcast is not implemented in this pass");
  }
  printDryRun();
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
  process.exit(bootstrap(process.argv.slice(2)));
}
