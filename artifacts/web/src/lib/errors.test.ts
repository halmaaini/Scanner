import { ApiError, ResponseParseError } from "@workspace/api-client-react";
import { describe, expect, it } from "vitest";
import { isNetworkError, isUnauthorized, statusOf } from "./errors";

const response = (status: number) => new Response(null, { status });
const request = { method: "GET", url: "/api/x" };
const apiError = (status: number) =>
  new ApiError(response(status), { error: "x" }, request);

describe("statusOf", () => {
  it("reads the status the API answered with", () => {
    expect(statusOf(apiError(403))).toBe(403);
  });

  it("is undefined when the API never answered", () => {
    expect(statusOf(new TypeError("Failed to fetch"))).toBeUndefined();
  });
});

describe("isUnauthorized", () => {
  it("is true only for a 401 from the API", () => {
    expect(isUnauthorized(apiError(401))).toBe(true);
    expect(isUnauthorized(apiError(403))).toBe(false);
    expect(isUnauthorized(new Error("401"))).toBe(false);
  });
});

describe("isNetworkError", () => {
  it("is true when nothing sensible came back", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new DOMException("timed out", "TimeoutError"))).toBe(
      true,
    );
    expect(
      isNetworkError(
        new ResponseParseError(
          response(200),
          "<html>",
          new Error("x"),
          request,
        ),
      ),
    ).toBe(true);
  });

  it("is true when a proxy says the API is down", () => {
    for (const status of [502, 503, 504]) {
      expect(isNetworkError(apiError(status))).toBe(true);
    }
  });

  it("is false for anything the API itself said, even an error", () => {
    for (const status of [400, 401, 403, 404, 429, 500]) {
      expect(isNetworkError(apiError(status))).toBe(false);
    }
  });
});
