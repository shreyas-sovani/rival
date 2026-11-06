import {
  BaseError,
  createPublicClient,
  decodeErrorResult,
  encodeFunctionData,
  http,
  keccak256,
  namehash,
  parseAbi,
  toBytes,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { PUBLIC_SEPOLIA_RPCS } from "../../data/live-market.ts";
import { publicDeployment } from "../../data/public-deployment.ts";

export const UNLISTED_FILLER = "0x1111111111111111111111111111111111111111" as Address;
export const FORGE_CALLER = "0x2222222222222222222222222222222222222222" as Address;
export const FILL_MAKER = "0x3333333333333333333333333333333333333333" as Address;
export const FILL_RECIPIENT = "0x4444444444444444444444444444444444444444" as Address;
export const FILL_INPUT_TO = "0x5555555555555555555555555555555555555555" as Address;

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

const errors = [
  "error NotListed()",
  "error NotAllowlisted()",
  "error GateFailed()",
  "error NotStarted()",
  "error Expired()",
  "error SelfFill()",
  "error BadParams()",
  "error EACUnauthorizedAccountRoles(uint256 resource, uint256 roleBitmap, address account)",
  "error EACCannotGrantRoles(uint256 resource, uint256 roleBitmap, address account)",
  "error Error(string)",
] as const;

const fillAbi = parseAbi([
  ...errors,
  "function fill((address maker,address tokenIn,address tokenOut,uint128 amountIn,address recipient,uint8 mode,uint128 baseOut,uint32 oracleWindow,int32 startBps,int32 floorBps,uint32 startTime,uint32 decaySecs,uint32 deadline,uint128 hardMinOut,uint8 gate,bytes32 allowlistHash,uint256 nonce) i, bytes makerSig, (address inputTo,bool useCallback,bytes data,bytes32[] allowLabels) p)",
]);

const textAbi = parseAbi([
  ...errors,
  "function setText(bytes name, string key, string value)",
  "function text(bytes32 node, string key) view returns (string)",
]);

const findAbi = parseAbi([
  "function findResolver(bytes name) view returns (address resolver, bytes32 node, uint256 offset)",
]);

const simulationErrors = parseAbi([...errors]);

const rolesAbi = parseAbi(["function roles(uint256 resource, address account) view returns (uint256)"]);

const NAMED_ROLES: Array<[string, bigint]> = [
  ["ROLE_REGISTRAR", 1n << 0n],
  ["ROLE_REGISTER_RESERVED", 1n << 4n],
  ["ROLE_SET_PARENT", 1n << 8n],
  ["ROLE_UNREGISTER", 1n << 12n],
  ["ROLE_RENEW", 1n << 16n],
  ["ROLE_SET_SUBREGISTRY", 1n << 20n],
  ["ROLE_SET_RESOLVER", 1n << 24n],
  ["ROLE_WAS_RESERVED", 1n << 32n],
  ["ROLE_SET_URI", 1n << 36n],
  ["ROLE_CAN_NAME", 1n << 120n],
  ["ROLE_UPGRADE", 1n << 124n],
  ["ROLE_REGISTRAR_ADMIN", 1n << 128n],
  ["ROLE_REGISTER_RESERVED_ADMIN", 1n << 132n],
  ["ROLE_SET_PARENT_ADMIN", 1n << 136n],
  ["ROLE_UNREGISTER_ADMIN", 1n << 140n],
  ["ROLE_RENEW_ADMIN", 1n << 144n],
  ["ROLE_SET_SUBREGISTRY_ADMIN", 1n << 148n],
  ["ROLE_SET_RESOLVER_ADMIN", 1n << 152n],
  ["ROLE_CAN_TRANSFER_ADMIN", (1n << 28n) << 128n],
  ["ROLE_WAS_RESERVED_ADMIN", 1n << 160n],
  ["ROLE_SET_URI_ADMIN", 1n << 164n],
  ["ROLE_CAN_NAME_ADMIN", 1n << 248n],
  ["ROLE_UPGRADE_ADMIN", 1n << 252n],
];

export interface CallDraft {
  from: Address;
  to: Address;
  data: Hex;
}

export function dnsEncode(name: string): Hex {
  if (name.length === 0) return "0x00";
  const bytes: number[] = [];
  for (const label of name.split(".")) {
    const raw = toBytes(label);
    if (raw.length === 0 || raw.length > 255) throw new Error("DNS label length out of range");
    bytes.push(raw.length, ...raw);
  }
  bytes.push(0);
  return `0x${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function parentNode(label?: string): Hex {
  const parent = label && label.length > 0 ? label : publicDeployment.ens.parentLabel;
  return namehash(`${parent}.eth`);
}

export function roleNames(bitmap: bigint): string[] {
  const names: string[] = [];
  let rest = bitmap;
  for (const [role, bit] of NAMED_ROLES) {
    if ((rest & bit) === bit) {
      names.push(role);
      rest &= ~bit;
    }
  }
  for (let bitIndex = 0; bitIndex < 256; bitIndex += 1) {
    const bit = 1n << BigInt(bitIndex);
    if ((rest & bit) !== 0n) names.push(`BIT_${bitIndex}`);
  }
  return names;
}

export function unlistedFillCall(): CallDraft {
  const data = encodeFunctionData({
    abi: fillAbi,
    functionName: "fill",
    args: [
      {
        maker: FILL_MAKER,
        tokenIn: publicDeployment.tokens.tWETH as Address,
        tokenOut: publicDeployment.tokens.tUSDC as Address,
        amountIn: 1n,
        recipient: FILL_RECIPIENT,
        mode: 0,
        baseOut: 0n,
        oracleWindow: 0,
        startBps: 0,
        floorBps: 0,
        startTime: 1,
        decaySecs: 0,
        deadline: 4_294_967_295,
        hardMinOut: 0n,
        gate: 1,
        allowlistHash: `0x${"00".repeat(32)}`,
        nonce: 0n,
      },
      "0x",
      {
        inputTo: FILL_INPUT_TO,
        useCallback: false,
        data: "0x",
        allowLabels: [],
      },
    ],
  });
  return { from: UNLISTED_FILLER, to: publicDeployment.settlement as Address, data };
}

/** Canonical Sepolia `PermissionedResolver.setText` takes a DNS-encoded name, not a namehash. */
export function forgeSetTextCall(resolver: Address, dnsName: Hex): CallDraft {
  const data = encodeFunctionData({
    abi: textAbi,
    functionName: "setText",
    args: [dnsName, "com.rival.fills", "1"],
  });
  return { from: FORGE_CALLER, to: resolver, data };
}

export function decodeSimulationRevert(data: Hex): string {
  try {
    const decoded = decodeErrorResult({ abi: simulationErrors, data });
    const args = decoded.args ?? [];
    if (args.length === 0) return `${decoded.errorName}()`;
    const rendered = args.map((arg) => (typeof arg === "bigint" ? arg.toString() : String(arg))).join(", ");
    return `${decoded.errorName}(${rendered})`;
  } catch {
    return data;
  }
}

export function formatSimulation(title: string, draft: CallDraft, revert: string): string {
  return [
    title,
    `from ${draft.from}`,
    `to ${draft.to}`,
    `calldata ${draft.data}`,
    `revert ${revert}`,
  ].join("\n");
}

function revertHex(error: unknown): Hex | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const found = error.walk((item) => {
    const data = (item as { data?: unknown }).data;
    return typeof data === "string" && data.startsWith("0x");
  }) as { data?: string } | null;
  return typeof found?.data === "string" ? (found.data as Hex) : undefined;
}

function isExecutionRevert(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  return /revert/i.test(`${error.shortMessage ?? ""} ${error.message}`);
}

async function withRpc<T>(read: (client: PublicClient) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const url of PUBLIC_SEPOLIA_RPCS) {
    try {
      const client = createPublicClient({ transport: http(url, { timeout: 12_000 }) });
      return await read(client);
    } catch (error) {
      if (isExecutionRevert(error)) throw error;
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("Sepolia RPC failed");
}

async function ethCall(draft: CallDraft): Promise<string> {
  try {
    await withRpc((client) =>
      client.call({
        account: draft.from,
        to: draft.to,
        data: draft.data,
      }),
    );
    return "eth_call succeeded and did not revert";
  } catch (error) {
    const data = revertHex(error);
    if (data) return decodeSimulationRevert(data);
    return error instanceof Error ? error.message : "eth_call failed";
  }
}

export async function simulateUnlistedFill(): Promise<string> {
  const draft = unlistedFillCall();
  const revert = await ethCall(draft);
  return formatSimulation("eth_call RivalSettlement.fill gate=listed from an unlisted address", draft, revert);
}

async function resolverFor(name: string): Promise<{ resolver: Address; node: Hex; source: string }> {
  const proxy = publicDeployment.ens.universalResolverProxy as Address;
  const fallback = publicDeployment.ens.permissionedResolverImpl as Address;
  const node = namehash(name);
  if (proxy.toLowerCase() === ZERO) {
    return { resolver: fallback, node, source: "permissioned resolver implementation" };
  }
  try {
    const found = await withRpc((client) =>
      client.readContract({
        address: proxy,
        abi: findAbi,
        functionName: "findResolver",
        args: [dnsEncode(name)],
      }),
    );
    const resolver = found[0];
    if (resolver.toLowerCase() !== ZERO) {
      return { resolver, node: found[1], source: "universal resolver proxy" };
    }
  } catch {
    // The name is not in the canonical tree yet. The implementation still enforces setText roles.
  }
  return { resolver: fallback, node, source: "permissioned resolver implementation" };
}

export async function simulateForgeRecord(): Promise<string> {
  const parent = publicDeployment.ens.parentLabel;
  const label = publicDeployment.solvers[0]?.label ?? "atlas";
  const name = `${label}.solvers.${parent}.eth`;
  const found = await resolverFor(name);
  const draft = forgeSetTextCall(found.resolver, dnsEncode(name));
  const revert = await ethCall(draft);
  return formatSimulation(
    `eth_call setText(com.rival.fills) on ${name} via ${found.source}`,
    draft,
    revert,
  );
}

export async function readLiveRoles(): Promise<string> {
  const registry = publicDeployment.ens.solversRegistry as Address;
  const names = publicDeployment.names as Address;
  if (registry.toLowerCase() === ZERO || names.toLowerCase() === ZERO) {
    return "BLOCKED: solvers registry or RivalNames address is zero";
  }
  try {
    const bitmap = await withRpc((client) =>
      client.readContract({
        address: registry,
        abi: rolesAbi,
        functionName: "roles",
        args: [0n, names],
      }),
    );
    const namesHeld = roleNames(bitmap);
    const body = namesHeld.length > 0 ? namesHeld.join(" | ") : "no named bits set";
    return `roles(0, ${names}) = ${bitmap.toString()} | ${body}`;
  } catch (error) {
    return error instanceof Error ? error.message : "role read failed";
  }
}

export function keccakLabel(label: string): Hex {
  return keccak256(toBytes(label));
}
