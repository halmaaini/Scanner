import { describe, expect, it } from "vitest";
import {
  createMemoryStorage,
  createSafeStorage,
  type KeyValueStore,
} from "./storage";

/** A store that refuses to write once "full", but can still read and remove. */
function fullAfter(writes: number) {
  const inner = createMemoryStorage();
  let left = writes;
  const store: KeyValueStore = {
    getItem: (key) => inner.getItem(key),
    setItem(key, value) {
      if (left-- <= 0) throw new DOMException("full", "QuotaExceededError");
      inner.setItem(key, value);
    },
    removeItem: (key) => inner.removeItem(key),
  };
  return { store, inner };
}

describe("safe storage", () => {
  it("passes reads and writes through to the real store", () => {
    const { store, inner } = fullAfter(10);
    const safe = createSafeStorage(store);
    safe.setItem("a", "1");
    expect(inner.getItem("a")).toBe("1");
    expect(safe.getItem("a")).toBe("1");
    safe.removeItem("a");
    expect(inner.getItem("a")).toBeNull();
  });

  it("keeps the newest value in memory when the real store refuses a write", () => {
    const { store, inner } = fullAfter(1);
    const safe = createSafeStorage(store);
    safe.setItem("outbox", "[1001]");
    safe.setItem("outbox", "[1001,1002]"); // refused: the store is full

    // Reads must not go back to the stale copy, or the second scan is lost.
    expect(safe.getItem("outbox")).toBe("[1001,1002]");
    expect(inner.getItem("outbox")).toBe("[1001]");
  });

  it("does not mix up keys: only the one that could not be saved is in memory", () => {
    const { store } = fullAfter(1);
    const safe = createSafeStorage(store);
    safe.setItem("a", "saved");
    safe.setItem("b", "memory only");
    expect(safe.getItem("a")).toBe("saved");
    expect(safe.getItem("b")).toBe("memory only");
  });

  it("goes back to the real store once it accepts writes again", () => {
    let writable = false;
    const inner = createMemoryStorage();
    const store: KeyValueStore = {
      getItem: (key) => inner.getItem(key),
      setItem(key, value) {
        if (!writable) throw new Error("blocked");
        inner.setItem(key, value);
      },
      removeItem: (key) => inner.removeItem(key),
    };
    const safe = createSafeStorage(store);
    safe.setItem("k", "1");
    writable = true;
    safe.setItem("k", "2");
    expect(inner.getItem("k")).toBe("2");
    expect(safe.getItem("k")).toBe("2");
  });

  it("removes a value from memory as well", () => {
    const { store } = fullAfter(0);
    const safe = createSafeStorage(store);
    safe.setItem("k", "1");
    safe.removeItem("k");
    expect(safe.getItem("k")).toBeNull();
  });

  it("works from memory alone when there is no browser storage", () => {
    const safe = createSafeStorage(null);
    safe.setItem("k", "1");
    expect(safe.getItem("k")).toBe("1");
    safe.removeItem("k");
    expect(safe.getItem("k")).toBeNull();
  });

  it("survives a store that throws on read", () => {
    const throwing: KeyValueStore = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    const safe = createSafeStorage(throwing);
    expect(safe.getItem("k")).toBeNull();
    safe.setItem("k", "1");
    expect(safe.getItem("k")).toBe("1");
    expect(() => safe.removeItem("k")).not.toThrow();
  });
});
