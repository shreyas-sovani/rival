import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv, { type ValidateFunction } from "ajv";

/**
 * Types for specs/deployments.schema.json ("Rival Sepolia deployment record").
 * String patterns, integer bounds, and additionalProperties are enforced by ajv in loadDeployments.
 */

export type SolverStrategy = "sprint" | "patient" | "arb" | "inventory" | "house" | "custom";

/** $defs.pool */
export interface Pool {
  poolId: string;
  fee: number;
  tickSpacing: number;
  currency0: string;
  currency1: string;
}

export interface Tokens {
  tWETH: string;
  tUSDC: string;
}

export interface Hook {
  address: string;
  flagBitsHex: string;
  salt: string;
}

export interface Ens {
  ethRegistrar: string;
  ethRegistry: string;
  rootRegistry: string;
  userRegistryImpl: string;
  verifiableFactory: string;
  permissionedResolverImpl: string;
  universalResolverV2: string;
  universalResolverProxy: string;
  parentLabel: string;
  solversRegistry: string;
}

export interface Solver {
  label: string;
  address: string;
  strategy: SolverStrategy;
}

/** Rival Sepolia deployment record. */
export interface RivalSepoliaDeploymentRecord {
  chainId: 11155111;
  tokens: Tokens;
  hook: Hook;
  pools: {
    A: Pool;
    B: Pool;
  };
  settlement: string;
  registry: string;
  names: string;
  uniswapSolvers: string[];
  ens: Ens;
  solvers: Solver[];
  arkivWriterAddresses: string[];
  /** HTTPS origin of the runner. */
  runnerUrl: string;
  commit: string;
}

const schemaPath = fileURLToPath(
  new URL("../../../specs/deployments.schema.json", import.meta.url),
);
const defaultDeploymentPath = fileURLToPath(
  new URL("../../../deployments/sepolia.json", import.meta.url),
);

function readJson(file: string, label: string): unknown {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENOENT") throw new Error(`Missing ${label}: ${file}`);
    throw new Error(`Cannot read ${label}: ${file}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} is not valid JSON: ${file}`);
  }
}

/**
 * Read deployments/sepolia.json and validate it against specs/deployments.schema.json.
 * Throws if the file is missing, unreadable, or invalid.
 */
export function loadDeployments(
  deploymentFile = defaultDeploymentPath,
): RivalSepoliaDeploymentRecord {
  const schema: unknown = readJson(schemaPath, "deployment schema");
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`Deployment schema is not an object: ${schemaPath}`);
  }
  const data = readJson(deploymentFile, "deployment file");
  const ajv = new Ajv({ allErrors: true, strict: true });
  let validate: ValidateFunction<RivalSepoliaDeploymentRecord>;
  try {
    validate = ajv.compile<RivalSepoliaDeploymentRecord>(schema);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Deployment schema failed to compile: ${message}`);
  }
  if (!validate(data)) {
    throw new Error(
      `${deploymentFile} failed schema validation: ${ajv.errorsText(validate.errors)}`,
    );
  }
  return data;
}
