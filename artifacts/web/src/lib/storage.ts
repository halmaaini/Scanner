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
 * localStorage that never throws. Private windows, blocked site data and a
 * full disk all make the real thing throw; the app then keeps working from
 * memory (it just cannot survive a reload).
 */
function createSafeStorage(): KeyValueStore {
  const fallback = createMemoryStorage();
  const real = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();

  return {
    getItem(key) {
      try {
        return real ? real.getItem(key) : fallback.getItem(key);
      } catch {
        return fallback.getItem(key);
      }
    },
    setItem(key, value) {
      try {
        if (!real) throw new Error("no storage");
        real.setItem(key, value);
      } catch {
        fallback.setItem(key, value);
      }
    },
    removeItem(key) {
      try {
        real?.removeItem(key);
      } catch {
        // nothing to do
      }
      fallback.removeItem(key);
    },
  };
}

export const appStorage: KeyValueStore = createSafeStorage();
