import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fromJSONSchema, type ZodType } from "zod";

const ENV_SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../../specs/env.schema.json");

interface JsonObjectSchema {
  type?: string;
  properties?: Record<string, { writeOnly?: boolean; type?: string }>;
  required?: string[];
  additionalProperties?: boolean;
}

interface EnvCatalog {
  properties: {
    runner: JsonObjectSchema;
  };
}

export type RunnerConfig = Record<string, string>;

let catalog: EnvCatalog | undefined;
let runnerSchema: ZodType | undefined;

function readCatalog(): EnvCatalog {
  if (!catalog) {
    catalog = JSON.parse(readFileSync(ENV_SCHEMA_PATH, "utf8")) as EnvCatalog;
  }
  return catalog;
}

/** Property names of `env.schema.json` target `runner`. */
export function runnerEnvNames(): string[] {
  return Object.keys(readCatalog().properties.runner.properties ?? {});
}

/** `writeOnly` names on the runner target. Logger redacts these. */
export function runnerSecretNames(): string[] {
  const properties = readCatalog().properties.runner.properties ?? {};
  return Object.entries(properties)
    .filter(([, property]) => property.writeOnly === true)
    .map(([name]) => name);
}

function runnerZod(): ZodType {
  if (!runnerSchema) {
    const runner = readCatalog().properties.runner;
    const normalized: unknown = JSON.parse(JSON.stringify(runner));
    runnerSchema = fromJSONSchema(normalized as Parameters<typeof fromJSONSchema>[0], { defaultTarget: "draft-7" });
  }
  return runnerSchema;
}

/**
 * Validate `env` against the runner target. Keys come from the schema file.
 * Extra process variables are ignored. Values are not included in the error.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): RunnerConfig {
  const names = runnerEnvNames();
  const input: Record<string, string> = {};
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string") input[name] = value;
  }
  const parsed = runnerZod().safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");
    throw new Error(`runner env invalid: ${fields}`);
  }
  return parsed.data as RunnerConfig;
}

export function configValue(config: RunnerConfig, name: string): string {
  const value = config[name];
  if (typeof value !== "string") {
    throw new Error(`runner env invalid: ${name}`);
  }
  return value;
}
