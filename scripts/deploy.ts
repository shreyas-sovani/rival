import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";
const ZERO = "0x0000000000000000000000000000000000000000";

type Deployment = {
  chainId: number;
  tokens: { tWETH: string; tUSDC: string };
  hook: { address: string; flagBitsHex: string; salt: string };
  pools: {
    A: { poolId: string; fee: number; tickSpacing: number; currency0: string; currency1: string };
    B: { poolId: string; fee: number; tickSpacing: number; currency0: string; currency1: string };
  };
  settlement: string;
  registry: string;
  names: string;
  uniswapSolvers: string[];
  ens: Record<string, string>;
  solvers: unknown[];
  arkivWriterAddresses: string[];
  runnerUrl: string;
  commit: string;
};

type Secrets = { rpc: string; key: string; etherscan: string };

function loadSecrets(): Secrets {
  const text = readFileSync(path.join(root, "secrets/.env.local"), "utf8");
  const values = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const body = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eq = body.indexOf("=");
    if (eq < 0) continue;
    const name = body.slice(0, eq).trim();
    const value = body.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    values.set(name, value);
  }
  const rpc = values.get("SEPOLIA_RPC_URL");
  const key = values.get("OPERATOR_PRIVATE_KEY");
  if (!rpc || !key) throw new Error("SEPOLIA_RPC_URL or OPERATOR_PRIVATE_KEY is missing");
  return { rpc, key, etherscan: values.get("ETHERSCAN_API_KEY") ?? "" };
}

function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length > 0) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/https?:\/\/\S+/g, "[redacted-url]");
}

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd = root,
): { status: number; output: string } {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return { status: result.status ?? 1, output };
}

function loadDeployment(): Deployment {
  const parsed: unknown = JSON.parse(readFileSync(path.join(root, "deployments/sepolia.json"), "utf8"));
  if (parsed === null || typeof parsed !== "object") throw new Error("deployments/sepolia.json is not an object");
  return parsed as Deployment;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function cast(args: string[], env: NodeJS.ProcessEnv, secrets: string[]): string {
  const result = run("cast", args, env);
  if (result.status !== 0) throw new Error(redact(result.output, secrets).slice(-2000));
  return result.output.trim();
}

function parseLabeled(output: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of output.split("\n")) {
    const match = line.match(/DEPLOY_([A-Z0-9_]+):?\s+(0x[0-9a-fA-F]+|\d+)/);
    const name = match?.[1];
    const value = match?.[2];
    if (name && value) fields.set(name, value);
  }
  return fields;
}

function requireAddress(fields: Map<string, string>, name: string): string {
  const value = fields.get(name);
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`missing ${name} in forge output`);
  return value;
}

function writeDeployment(deployment: Deployment, settlement: string, solver: string): void {
  const next: Deployment = {
    ...deployment,
    settlement,
    uniswapSolvers: [solver],
  };
  writeFileSync(path.join(root, "deployments/sepolia.json"), `${JSON.stringify(next, null, 2)}\n`);
}

function linkedLibrary(): string {
  const file = path.join(root, "contracts/broadcast/Deploy.s.sol/11155111/run-latest.json");
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    transactions?: Array<{ contractName?: string; contractAddress?: string | null }>;
  };
  const match = parsed.transactions?.find((tx) => tx.contractName === "RivalMath" && tx.contractAddress);
  if (!match?.contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(match.contractAddress)) {
    throw new Error("RivalMath library address missing from broadcast");
  }
  return match.contractAddress;
}

function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function appendDoc(
  settlement: string,
  solver: string,
  deployment: Deployment,
  operator: string,
  library: string,
): void {
  const file = path.join(root, "docs/oracle.md");
  const current = readFileSync(file, "utf8");
  if (current.includes("## Settlement")) return;
  const section = `
## Settlement

The venue section above left settlement at the zero address. That placeholder is superseded by this deploy. RivalSettlement \`${settlement}\` and UniswapSolver \`${solver}\` are on Sepolia. SolverRegistry \`${deployment.registry}\` accepted \`setSettlement\` in the settlement creation transaction, and \`settlementLocked\` is true. Pair config is pool A: currency0 \`${deployment.pools.A.currency0}\`, currency1 \`${deployment.pools.A.currency1}\`, fee 500, tick spacing 10, hook \`${deployment.hook.address}\`. Permit2 \`${PERMIT2}\`. PoolManager \`${POOL_MANAGER}\`. RivalSettlement links RivalMath at \`${library}\`. The solver owner is the operator \`${operator}\`. Solver names were not registered in this pass.
`;
  writeFileSync(file, `${current.trimEnd()}\n${section}`);
}

function main(): number {
  const simulate = process.argv.includes("--simulate");
  const broadcast = process.argv.includes("--broadcast");
  if (simulate === broadcast) {
    console.error("pass exactly one of --simulate or --broadcast");
    return 1;
  }

  const { rpc, key, etherscan } = loadSecrets();
  const secrets = [rpc, key, etherscan].filter((secret) => secret.length > 0);
  const deployment = loadDeployment();
  if (deployment.chainId !== 11155111) throw new Error("chainId is not Sepolia");
  if (!sameAddress(deployment.settlement, ZERO) || deployment.uniswapSolvers.length !== 0) {
    throw new Error("settlement or uniswapSolvers is already recorded; refusing to deploy again");
  }
  if (deployment.pools.A.fee !== 500 || deployment.pools.A.tickSpacing !== 10) {
    throw new Error("pool A fee or tick spacing does not match the settlement pair");
  }
  if (
    !sameAddress(deployment.pools.A.currency0, deployment.tokens.tWETH) ||
    !sameAddress(deployment.pools.A.currency1, deployment.tokens.tUSDC)
  ) {
    throw new Error("pool A currencies do not match the recorded tokens");
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SEPOLIA_RPC_URL: rpc,
    OPERATOR_PRIVATE_KEY: key,
    PERMIT2,
    POOL_MANAGER,
    ORACLE: deployment.hook.address,
    REGISTRY: deployment.registry,
    CURRENCY0: deployment.pools.A.currency0,
    CURRENCY1: deployment.pools.A.currency1,
    HOOKS: deployment.hook.address,
  };
  const rpcEnv: NodeJS.ProcessEnv = { ...env, ETH_RPC_URL: rpc };

  const operator = cast(["wallet", "address", "--private-key", key], rpcEnv, secrets);
  const bound = cast(["call", deployment.registry, "settlement()(address)"], rpcEnv, secrets);
  const locked = cast(["call", deployment.registry, "settlementLocked()(bool)"], rpcEnv, secrets);
  if (!sameAddress(bound, ZERO) || locked !== "false") {
    throw new Error(`registry already bound settlement ${bound} locked ${locked}`);
  }

  const forgeArgs = [
    "script",
    "script/Deploy.s.sol:Deploy",
    "--rpc-url",
    "sepolia",
    "--private-key",
    key,
    "--non-interactive",
    "--gas-estimate-multiplier",
    "800",
    "-vv",
  ];
  if (broadcast) forgeArgs.push("--broadcast", "--slow");
  console.log(broadcast ? "broadcasting settlement and solver" : "simulating settlement and solver");
  const forge = run("forge", forgeArgs, env, path.join(root, "contracts"));
  const safeLog = redact(forge.output, secrets);
  const fields = parseLabeled(safeLog);
  const labeled = [...fields.entries()].map(([name, value]) => `DEPLOY_${name} ${value}`).join("\n");
  if (labeled) console.log(labeled);
  if (forge.status !== 0) {
    const interesting = safeLog
      .split("\n")
      .filter((line) => /Error|Revert|revert|FAIL|Panic|DEPLOY_|AlreadyBound|Wiring|CodeMissing/.test(line))
      .join("\n");
    console.error((interesting || safeLog).slice(-8000));
    return forge.status === 0 ? 1 : forge.status;
  }

  const settlement = requireAddress(fields, "SETTLEMENT");
  const solver = requireAddress(fields, "SOLVER");
  const loggedOperator = requireAddress(fields, "OPERATOR");
  if (fields.get("LOCKED") !== "1") throw new Error("setSettlement did not lock the registry");
  if (!sameAddress(loggedOperator, operator)) throw new Error("operator mismatch");
  if (sameAddress(settlement, solver)) throw new Error("settlement and solver addresses match");

  if (!broadcast) {
    console.log("simulation ok");
    return 0;
  }

  const settlementCode = cast(["codesize", settlement], rpcEnv, secrets);
  const solverCode = cast(["codesize", solver], rpcEnv, secrets);
  if (settlementCode === "0" || solverCode === "0") {
    throw new Error(`empty code settlement ${settlementCode} solver ${solverCode}`);
  }
  const onchainSettlement = cast(["call", deployment.registry, "settlement()(address)"], rpcEnv, secrets);
  const onchainLocked = cast(["call", deployment.registry, "settlementLocked()(bool)"], rpcEnv, secrets);
  const reads: Array<[string, string, string]> = [
    [settlement, "permit2()(address)", PERMIT2],
    [settlement, "oracle()(address)", deployment.hook.address],
    [settlement, "registry()(address)", deployment.registry],
    [settlement, "currency0()(address)", deployment.pools.A.currency0],
    [settlement, "currency1()(address)", deployment.pools.A.currency1],
    [settlement, "hooks()(address)", deployment.hook.address],
    [solver, "settlement()(address)", settlement],
    [solver, "poolManager()(address)", POOL_MANAGER],
    [solver, "owner()(address)", operator],
  ];
  for (const [target, signature, expected] of reads) {
    const actual = cast(["call", target, signature], rpcEnv, secrets);
    if (!sameAddress(actual, expected)) throw new Error(`${signature} was ${actual}`);
  }
  const fee = cast(["call", settlement, "poolFee()(uint24)"], rpcEnv, secrets);
  const spacing = cast(["call", settlement, "tickSpacing()(int24)"], rpcEnv, secrets);
  if (fee !== "500" || spacing !== "10") throw new Error(`pair config fee ${fee} spacing ${spacing}`);
  if (!sameAddress(onchainSettlement, settlement) || onchainLocked !== "true") {
    throw new Error(`setSettlement result ${onchainSettlement} locked ${onchainLocked}`);
  }

  writeDeployment(deployment, settlement, solver);
  const ajv = run(
    "pnpm",
    ["exec", "ajv", "validate", "-s", "specs/deployments.schema.json", "-d", "deployments/sepolia.json", "--spec=draft7"],
    process.env,
  );
  if (ajv.status !== 0) {
    console.error(redact(ajv.output, secrets));
    return ajv.status === 0 ? 1 : ajv.status;
  }
  const library = linkedLibrary();
  appendDoc(settlement, solver, deployment, operator, library);
  console.log(`schema ok; setSettlement true; settlement code ${settlementCode}; solver code ${solverCode}`);
  console.log(`settlement ${settlement}`);
  console.log(`solver ${solver}`);

  if (etherscan.length === 0) {
    console.log("etherscan skipped: ETHERSCAN_API_KEY is absent");
    return 0;
  }
  const encodedSettlement = cast(
    [
      "abi-encode",
      "constructor(address,address,address,(address,address,uint24,int24,address))",
      PERMIT2,
      deployment.hook.address,
      deployment.registry,
      `(${deployment.pools.A.currency0},${deployment.pools.A.currency1},500,10,${deployment.hook.address})`,
    ],
    rpcEnv,
    secrets,
  );
  const encodedSolver = cast(
    ["abi-encode", "constructor(address,address,address)", settlement, POOL_MANAGER, operator],
    rpcEnv,
    secrets,
  );
  const verifyEnv: NodeJS.ProcessEnv = { ...rpcEnv, ETHERSCAN_API_KEY: etherscan };
  const verifyOne = (address: string, contract: string, args: string, libraries?: string): number => {
    const forgeArgs = [
      "verify-contract",
      "--chain",
      "11155111",
      "--rpc-url",
      rpc,
      "--watch",
      "--constructor-args",
      args,
    ];
    if (libraries) forgeArgs.push("--libraries", libraries);
    forgeArgs.push(address, contract);
    const attempt = (): { status: number; output: string } =>
      run("forge", forgeArgs, verifyEnv, path.join(root, "contracts"));
    let result = attempt();
    if (result.status !== 0 && result.output.includes("Unable to locate ContractCode")) {
      pause(20_000);
      result = attempt();
    }
    console.log(redact(result.output, secrets).slice(-2500));
    return result.status;
  };
  const settlementStatus = verifyOne(
    settlement,
    "src/RivalSettlement.sol:RivalSettlement",
    encodedSettlement,
    `src/libs/RivalMath.sol:RivalMath:${library}`,
  );
  const solverStatus = verifyOne(solver, "src/solver/UniswapSolver.sol:UniswapSolver", encodedSolver);
  if (settlementStatus !== 0 || solverStatus !== 0) {
    console.error("etherscan verification failed");
    return settlementStatus || solverStatus;
  }
  console.log("etherscan verified");
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  const message = error instanceof Error ? error.message : "deploy failed";
  console.error(message.replace(/https?:\/\/\S+/g, "[redacted-url]"));
  process.exit(1);
}
