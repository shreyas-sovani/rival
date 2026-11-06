import { createPublicClient, createWalletClient, getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { rivalDeployment } from "./deployment.ts";
import { createRpcPool } from "./rpc-pool.ts";

const registryAbi = [
  {
    type: "function",
    name: "labelOf",
    stateMutability: "view",
    inputs: [{ name: "solver", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "depositToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "depositAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "label", type: "string" }],
    outputs: [],
  },
] as const;

const tokenAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export interface InitSolverClients {
  publicClient: {
    readContract: (args: {
      address: Address;
      abi: unknown;
      functionName: string;
      args?: readonly unknown[];
    }) => Promise<unknown>;
    waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status: string }>;
  };
  walletClient: {
    writeContract: (args: {
      address: Address;
      abi: unknown;
      functionName: string;
      args?: readonly unknown[];
      account?: unknown;
      chain?: unknown;
    }) => Promise<Hex>;
  };
  account: { address: Address };
}

export interface InitSolverResult {
  address: Address;
  label: string;
  listed: boolean;
}

function asUint(value: unknown, label: string): bigint {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^[0-9]+$/.test(value)) return BigInt(value);
  throw new Error(`${label} is not a uint`);
}

function asAddress(value: unknown, label: string): Address {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} is not an address`);
  }
  return getAddress(value);
}

function connect(key: Hex, rpc: string): InitSolverClients & { account: PrivateKeyAccount } {
  const account = privateKeyToAccount(key);
  const transport = createRpcPool([rpc], { timeoutMs: 8_000, cooldownMs: 2_000 });
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });
  return {
    account,
    publicClient: publicClient as InitSolverClients["publicClient"],
    walletClient: walletClient as InitSolverClients["walletClient"],
  };
}

async function mined(
  clients: InitSolverClients,
  hash: Hex,
  label: string,
): Promise<void> {
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} reverted`);
}

/**
 * Register `label` on SolverRegistry.
 * When `labelOf` is already set, returns that label and does not send `register` again.
 * Tests inject clients; the CLI path builds them from `key` and `rpc`.
 */
export async function initSolver(
  opts: { label: string; key: Hex; rpc: string },
  deps?: { clients?: InitSolverClients },
): Promise<InitSolverResult> {
  const requested = opts.label.trim();
  if (!requested) throw new Error("label is required");
  const registry = rivalDeployment().registry;
  const clients = deps?.clients ?? connect(opts.key, opts.rpc);
  const account = clients.account;

  const existing = String(
    await clients.publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "labelOf",
      args: [account.address],
    }),
  );
  if (existing.trim() !== "") {
    return { address: account.address, label: existing, listed: true };
  }

  const depositToken = asAddress(
    await clients.publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "depositToken",
    }),
    "depositToken",
  );
  const depositAmount = asUint(
    await clients.publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "depositAmount",
    }),
    "depositAmount",
  );
  const allowance = asUint(
    await clients.publicClient.readContract({
      address: depositToken,
      abi: tokenAbi,
      functionName: "allowance",
      args: [account.address, registry],
    }),
    "allowance",
  );

  const signer = "signTypedData" in account ? (account as PrivateKeyAccount) : privateKeyToAccount(opts.key);

  if (allowance < depositAmount) {
    const approved = await clients.walletClient.writeContract({
      address: depositToken,
      abi: tokenAbi,
      functionName: "approve",
      args: [registry, depositAmount],
      account: signer,
      chain: sepolia,
    });
    await mined(clients, approved, "deposit approval");
  }

  const registered = await clients.walletClient.writeContract({
    address: registry,
    abi: registryAbi,
    functionName: "register",
    args: [requested],
    account: signer,
    chain: sepolia,
  });
  await mined(clients, registered, "register");

  const stored = String(
    await clients.publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "labelOf",
      args: [account.address],
    }),
  );
  return { address: account.address, label: stored, listed: stored.trim() !== "" };
}
