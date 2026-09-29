/** The small part of `Storage` the app uses; also what the query persister expects. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A store that lives only as long as the page. Used in tests and as a fallback. */
export function createMemoryStorage(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

/**
 * Wraps a browser store so it never throws. Private windows, blocked site data
 * and a full disk all make the real thing throw; a value that could not be
 * saved then lives in memory instead (it just cannot survive a reload), and
 * reads keep returning the newest value, wherever it went.
 */
export function createSafeStorage(real: KeyValueStore | null): KeyValueStore {
  const memory = createMemoryStorage();
  /** Keys whose newest value is only in memory, because the real store refused it. */
  const inMemory = new Set<string>();

  return {
    getItem(key) {
      if (inMemory.has(key)) return memory.getItem(key);
      try {
        return real ? real.getItem(key) : memory.getItem(key);
      } catch {
        return memory.getItem(key);
      }
    },
    setItem(key, value) {
      try {
        if (!real) throw new Error("no storage");
        real.setItem(key, value);
        // The real store has the newest value again.
        inMemory.delete(key);
        memory.removeItem(key);
      } catch {
        inMemory.add(key);
        memory.setItem(key, value);
      }
    },
    removeItem(key) {
      try {
        real?.removeItem(key);
      } catch {
        // nothing to do
      }
      inMemory.delete(key);
      memory.removeItem(key);
    },
  };
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const appStorage: KeyValueStore = createSafeStorage(browserStorage());
