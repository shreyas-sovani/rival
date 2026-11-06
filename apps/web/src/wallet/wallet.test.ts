import { describe, expect, it } from "vitest";
import { memoryStorage } from "./storage.ts";
import { createEncryptedWallet, unlockWallet } from "./wallet.ts";

describe("encrypted wallet", () => {
  it("round-trips the address and keeps the private key out of storage", async () => {
    const map = new Map<string, string>();
    const storage = memoryStorage(map);
    const created = await createEncryptedWallet("correct horse", storage);
    const opened = await unlockWallet("correct horse", storage);

    expect(opened.address).toBe(created.address);
    expect(opened.account.address).toBe(created.address);
    expect(opened.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
    for (const value of map.values()) {
      expect(value.includes(opened.privateKey)).toBe(false);
      expect(value.toLowerCase().includes(opened.privateKey.slice(2).toLowerCase())).toBe(false);
    }
  });

  it("fails to decrypt with the wrong passphrase", async () => {
    const storage = memoryStorage();
    await createEncryptedWallet("correct horse", storage);
    await expect(unlockWallet("wrong horse", storage)).rejects.toThrow(/passphrase/i);
  });
});
