import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type FreezeDoc } from "./freeze-lib.ts";

const HEADER = "// GENERATED — do not edit\n";

const root = fileURLToPath(new URL("..", import.meta.url));
const generatedDir = path.join(root, "packages/chain/src/generated");

/**
 * Address slots in specs/deployments.schema.json and the forge artifact that
 * implements them. The schema stores addresses, not Solidity names.
 * External ENS addresses (ethRegistrar, ethRegistry, and the other canonical
 * ENSv2 contracts) are not compiled into contracts/out.
 */
const SCHEMA_SLOTS: ReadonlyArray<{ slot: string; artifact: string }> = [
  { slot: "tokens.tWETH", artifact: "TestToken" },
  { slot: "tokens.tUSDC", artifact: "TestToken" },
  { slot: "hook.address", artifact: "RivalOracleHook" },
  { slot: "settlement", artifact: "RivalSettlement" },
  { slot: "registry", artifact: "SolverRegistry" },
  { slot: "names", artifact: "RivalNames" },
  { slot: "uniswapSolvers", artifact: "UniswapSolver" },
  { slot: "ens.solversRegistry", artifact: "PermissionedRegistry" },
];

interface SchemaNode {
  properties?: Record<string, SchemaNode>;
  $ref?: string;
  $defs?: Record<string, SchemaNode>;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deref(schema: SchemaNode, node: SchemaNode): SchemaNode {
  if (!node.$ref) return node;
  if (!node.$ref.startsWith("#/")) throw new Error(`unsupported schema $ref ${node.$ref}`);
  let current: unknown = schema;
  for (const part of node.$ref.slice(2).split("/")) {
    if (!isSchemaNode(current)) throw new Error(`unresolved schema $ref ${node.$ref}`);
    const next: unknown = (current as Record<string, unknown>)[part];
    current = next;
  }
  if (!isSchemaNode(current)) throw new Error(`unresolved schema $ref ${node.$ref}`);
  return current;
}

function schemaHasSlot(schema: SchemaNode, slot: string): boolean {
  let node: SchemaNode = schema;
  for (const part of slot.split(".")) {
    node = deref(schema, node);
    const next = node.properties?.[part];
    if (!next) return false;
    node = next;
  }
  return true;
}

function f1Artifacts(doc: FreezeDoc): string[] {
  const names: string[] = [];
  for (const file of doc.files) {
    if (file.set !== "F1" || !file.path.endsWith(".sol")) continue;
    names.push(path.basename(file.path, ".sol"));
  }
  return names;
}

function schemaArtifacts(schema: SchemaNode): string[] {
  const names: string[] = [];
  for (const { slot, artifact } of SCHEMA_SLOTS) {
    if (!schemaHasSlot(schema, slot)) {
      throw new Error(`deployments.schema.json has no slot ${slot} for ${artifact}`);
    }
    names.push(artifact);
  }
  return names;
}

function exportName(artifact: string): string {
  return `${artifact.slice(0, 1).toLowerCase()}${artifact.slice(1)}Abi`;
}

function artifactFile(artifact: string): string {
  return path.join(root, "contracts/out", `${artifact}.sol`, `${artifact}.json`);
}

function loadAbi(artifact: string): unknown[] | undefined {
  const file = artifactFile(artifact);
  if (!existsSync(file)) return undefined;
  const parsed: unknown = readJson(file);
  if (!parsed || typeof parsed !== "object" || !("abi" in parsed)) return undefined;
  const abi = (parsed as { abi: unknown }).abi;
  if (!Array.isArray(abi)) return undefined;
  return abi;
}

function renderAbi(artifact: string, abi: unknown[]): string {
  return `${HEADER}export const ${exportName(artifact)} = ${JSON.stringify(abi, null, 2)} as const;\n`;
}

function renderIndex(artifacts: readonly string[]): string {
  const imports = artifacts
    .map((artifact) => `import { ${exportName(artifact)} } from "./${artifact}.ts";`)
    .join("\n");
  const exports = artifacts.map((artifact) => exportName(artifact)).join(",\n  ");
  const entries = artifacts.map((artifact) => `  ${artifact}: ${exportName(artifact)},`).join("\n");
  return `${HEADER}${imports}\n\nexport {\n  ${exports},\n};\n\nexport const abis = {\n${entries}\n} as const;\n`;
}

function rel(file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

function main(): void {
  const freeze = readJson(path.join(root, "specs/FREEZE.json")) as FreezeDoc;
  const schemaParsed = readJson(path.join(root, "specs/deployments.schema.json"));
  if (!isSchemaNode(schemaParsed)) throw new Error("deployments.schema.json is not an object");

  const artifacts = [...new Set([...f1Artifacts(freeze), ...schemaArtifacts(schemaParsed)])].sort(
    (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  );

  const missing: string[] = [];
  const written: string[] = [];
  const files = new Map<string, string>();

  for (const artifact of artifacts) {
    const abi = loadAbi(artifact);
    if (!abi) {
      missing.push(artifact);
      console.error(
        `missing ABI artifact: ${artifact} (contracts/out/${artifact}.sol/${artifact}.json)`,
      );
      continue;
    }
    const filename = `${artifact}.ts`;
    files.set(filename, renderAbi(artifact, abi));
    written.push(artifact);
  }

  mkdirSync(generatedDir, { recursive: true });
  if (written.length > 0) files.set("index.ts", renderIndex(written));

  for (const [filename, contents] of files) {
    writeFileSync(path.join(generatedDir, filename), contents);
  }

  if (existsSync(generatedDir)) {
    for (const entry of readdirSync(generatedDir)) {
      if (!entry.endsWith(".ts") || files.has(entry)) continue;
      rmSync(path.join(generatedDir, entry));
    }
  }

  for (const artifact of written) {
    console.log(`wrote ${rel(path.join(generatedDir, `${artifact}.ts`))}`);
  }
  if (written.length > 0) console.log(`wrote ${rel(path.join(generatedDir, "index.ts"))}`);
  console.log(`generated ${written.length} ABI file(s); missing ${missing.length}`);
}

main();
