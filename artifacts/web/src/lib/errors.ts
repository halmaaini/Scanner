import { ApiError, ResponseParseError } from "@workspace/api-client-react";

/** The server answered with this HTTP status; undefined if it never answered. */
export function statusOf(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

/** Not signed in, or the session ended. */
export const isUnauthorized = (error: unknown) => statusOf(error) === 401;

/**
 * The request never got a proper answer: no connection, a timeout, a dropped
 * response. Anything the server actually said (even an error) is not this.
 */
export const isNetworkError = (error: unknown) =>
  !(error instanceof ApiError || error instanceof ResponseParseError);
