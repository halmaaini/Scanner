import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUuid } from "./uuid";

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe("randomUuid", () => {
  it("makes a v4 UUID", () => {
    expect(randomUuid()).toMatch(V4);
  });

  it("still makes one where crypto.randomUUID is not available (plain http)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    const ids = new Set(Array.from({ length: 50 }, randomUuid));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(V4);
  });
});
