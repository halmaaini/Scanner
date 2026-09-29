import { afterEach, describe, expect, it, vi } from "vitest";

// config.ts reads the environment when it is first loaded, so each case loads a fresh copy.
async function loadWith(trustProxyHops: string | undefined) {
  vi.resetModules();
  if (trustProxyHops === undefined) vi.stubEnv("TRUST_PROXY_HOPS", undefined);
  else vi.stubEnv("TRUST_PROXY_HOPS", trustProxyHops);
  return import("./config");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("TRUST_PROXY_HOPS", () => {
  it("is one proxy (Replit's edge) unless set", async () => {
    expect((await loadWith(undefined)).TRUST_PROXY_HOPS).toBe(1);
    expect((await loadWith("")).TRUST_PROXY_HOPS).toBe(1);
  });

  it("takes any whole number of proxies, including none", async () => {
    expect((await loadWith("0")).TRUST_PROXY_HOPS).toBe(0);
    expect((await loadWith("2")).TRUST_PROXY_HOPS).toBe(2);
  });

  it("refuses anything else instead of guessing", async () => {
    for (const bad of ["-1", "1.5", "two"]) {
      await expect(loadWith(bad)).rejects.toThrow(
        /TRUST_PROXY_HOPS must be a whole number/,
      );
    }
  });
});
