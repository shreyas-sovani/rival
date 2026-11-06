/** Persistence port. Production can back this with IndexedDB; tests pass a Map. */
export interface StoragePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export function memoryStorage(map: Map<string, string> = new Map()): StoragePort {
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}
