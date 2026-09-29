import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ResponseParseError,
  customFetch,
  setRequestTimeout,
} from "./custom-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setRequestTimeout(null);
});

const stubFetch = (respond: (init: RequestInit) => Promise<Response>) =>
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: unknown, init: RequestInit) => respond(init)),
  );

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });

describe("customFetch", () => {
  it("reads a JSON answer", async () => {
    stubFetch(async () => json({ ok: true }));
    expect(await customFetch("/api/x")).toEqual({ ok: true });
  });

  it("returns null for an empty answer such as a 204", async () => {
    stubFetch(async () => new Response(null, { status: 204 }));
    expect(await customFetch("/api/x", { method: "POST" })).toBeNull();
  });

  // A proxy, a Wi-Fi login page or a static host's fallback can answer an API
  // path with 200 and HTML. That must not be handed to the app as data.
  it("refuses a 200 that is not JSON", async () => {
    stubFetch(
      async () =>
        new Response("<!doctype html><title>Sign in</title>", {
          headers: { "content-type": "text/html" },
        }),
    );
    await expect(customFetch("/api/roster")).rejects.toBeInstanceOf(
      ResponseParseError,
    );
  });

  it("raises an ApiError, with the server's message, for an error status", async () => {
    stubFetch(async () => json({ error: "Not signed in" }, { status: 401 }));
    const error: unknown = await customFetch("/api/auth/me").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
    expect((error as ApiError).message).toContain("Not signed in");
  });

  describe("timeout", () => {
    /** A server that never answers, but does notice being hung up on. */
    const hang = (init: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init.signal?.addEventListener("abort", () =>
          reject(init.signal?.reason),
        ),
      );

    it("gives up on a request that never finishes", async () => {
      vi.useFakeTimers();
      setRequestTimeout(5_000);
      stubFetch(hang);

      const result = customFetch("/api/roster").catch((e) => e);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await result).toMatchObject({ name: "TimeoutError" });
    });

    it("still honours the caller's own signal", async () => {
      setRequestTimeout(60_000);
      stubFetch(hang);
      const controller = new AbortController();

      const result = customFetch("/api/scans", {
        signal: controller.signal,
      }).catch((e) => e);
      controller.abort(new Error("superseded"));
      expect(await result).toMatchObject({ message: "superseded" });
    });

    it("has no limit unless one is set", async () => {
      vi.useFakeTimers();
      stubFetch(async () => {
        await new Promise((done) => setTimeout(done, 120_000));
        return json({ late: true });
      });
      const result = customFetch("/api/roster");
      await vi.advanceTimersByTimeAsync(120_000);
      expect(await result).toEqual({ late: true });
    });
  });
});
