import type { Address } from "./types.ts";

export interface NonceManager {
  next(address: Address): bigint;
  markUsed(address: Address, nonce: bigint): void;
}

/** In-memory pending nonce per address. Two addresses do not share a counter. */
export function nonceManager(): NonceManager {
  const nextByAddress = new Map<string, bigint>();

  function key(address: Address): string {
    return address.toLowerCase();
  }

  return {
    next(address) {
      return nextByAddress.get(key(address)) ?? 0n;
    },
    markUsed(address, nonce) {
      const id = key(address);
      const upcoming = nonce + 1n;
      const current = nextByAddress.get(id) ?? 0n;
      if (upcoming > current) nextByAddress.set(id, upcoming);
    },
  };
}
