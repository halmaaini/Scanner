import { ApiError } from "@workspace/api-client-react";

/** The server answered with this HTTP status; undefined if it never answered. */
export function statusOf(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

/** Not signed in, or the session ended. */
export const isUnauthorized = (error: unknown) => statusOf(error) === 401;

/** What a proxy answers when the API behind it is down or restarting. */
const GATEWAY_STATUSES = [502, 503, 504];

/**
 * The API did not really answer: no connection, a timeout, a dropped response,
 * an answer that is not JSON (a Wi-Fi login page, a proxy's error page), or a
 * proxy saying the API is down. Anything the API itself said, even an error,
 * is not this.
 */
export const isNetworkError = (error: unknown) =>
  !(error instanceof ApiError) || GATEWAY_STATUSES.includes(error.status);

/**
 * `fetch` itself failed: no connection, or a host that cannot be reached. The
 * request most likely never got there. A timeout, a dropped answer or a
 * proxy's error page is different: the server may well have acted on it.
 */
export const failedToConnect = (error: unknown) => error instanceof TypeError;
