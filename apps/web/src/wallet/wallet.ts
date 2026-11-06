import type { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { StoragePort } from "./storage.ts";

const STORAGE_KEY = "rival.wallet.v1";
const PBKDF2_ITERATIONS = 100_000;

export interface UnlockedWallet {
  address: Address;
  privateKey: Hex;
  account: PrivateKeyAccount;
}

interface StoredWallet {
  v: 1;
  address: Address;
  salt: string;
  iv: string;
  ciphertext: string;
}

function subtle(): SubtleCrypto {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle) {
    throw new Error("Web Crypto is unavailable");
  }
  return crypto.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Copy into a fresh ArrayBuffer so Web Crypto accepts the view. */
function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function deriveKey(passphrase: string, salt: ArrayBuffer, usages: KeyUsage[]): Promise<CryptoKey> {
  const material = await subtle().importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

async function encryptPrivateKey(privateKey: Hex, passphrase: string): Promise<Pick<StoredWallet, "salt" | "iv" | "ciphertext">> {
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);
  const key = await deriveKey(passphrase, arrayBuffer(salt), ["encrypt"]);
  const ciphertext = new Uint8Array(
    await subtle().encrypt({ name: "AES-GCM", iv: arrayBuffer(iv) }, key, new TextEncoder().encode(privateKey)),
  );
  return { salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

async function decryptPrivateKey(stored: StoredWallet, passphrase: string): Promise<Hex> {
  const salt = fromBase64(stored.salt);
  const iv = fromBase64(stored.iv);
  const ciphertext = fromBase64(stored.ciphertext);
  const key = await deriveKey(passphrase, arrayBuffer(salt), ["decrypt"]);
  let plain: ArrayBuffer;
  try {
    plain = await subtle().decrypt({ name: "AES-GCM", iv: arrayBuffer(iv) }, key, arrayBuffer(ciphertext));
  } catch {
    throw new Error("wrong passphrase");
  }
  const text = new TextDecoder().decode(plain);
  if (!/^0x[0-9a-fA-F]{64}$/.test(text)) {
    throw new Error("wrong passphrase");
  }
  return text as Hex;
}

function parseStored(raw: string): StoredWallet {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("corrupt wallet");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("corrupt wallet");
  }
  const record = parsed as Partial<StoredWallet>;
  if (
    record.v !== 1 ||
    typeof record.address !== "string" ||
    typeof record.salt !== "string" ||
    typeof record.iv !== "string" ||
    typeof record.ciphertext !== "string"
  ) {
    throw new Error("corrupt wallet");
  }
  return record as StoredWallet;
}

/** Create a random viem account and store only the AES-GCM ciphertext. */
export async function createEncryptedWallet(
  passphrase: string,
  storage: StoragePort,
): Promise<{ address: Address }> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encrypted = await encryptPrivateKey(privateKey, passphrase);
  const stored: StoredWallet = { v: 1, address: account.address, ...encrypted };
  await storage.set(STORAGE_KEY, JSON.stringify(stored));
  return { address: account.address };
}

/** Decrypt the stored key. A wrong passphrase fails AES-GCM authentication. */
export async function unlockWallet(passphrase: string, storage: StoragePort): Promise<UnlockedWallet> {
  const raw = await storage.get(STORAGE_KEY);
  if (raw === null) {
    throw new Error("no wallet");
  }
  const stored = parseStored(raw);
  const privateKey = await decryptPrivateKey(stored, passphrase);
  const account = privateKeyToAccount(privateKey);
  if (account.address.toLowerCase() !== stored.address.toLowerCase()) {
    throw new Error("corrupt wallet");
  }
  return { address: account.address, privateKey, account };
}
