/** Persistence port. Production uses localStorage; tests pass a Map. */
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

const memoryFallback = memoryStorage();

function localStorageOrNull(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = "rival.storage.probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** localStorage when the browser provides it. Otherwise one in-memory port for this page load. */
export function browserStorage(): StoragePort {
  const storage = localStorageOrNull();
  if (!storage) return memoryFallback;
  return {
    async get(key) {
      return storage.getItem(key);
    },
    async set(key, value) {
      storage.setItem(key, value);
    },
  };
}
