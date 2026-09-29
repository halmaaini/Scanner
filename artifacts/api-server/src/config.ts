/**
 * Tunables in one place. Nothing here is a secret; secrets come from the
 * environment (DATABASE_URL, SESSION_SECRET).
 */

export const isProduction = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_NAME = "sid";

/** A staff session ends after this long without any request (it slides). */
export const SESSION_IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export interface RateLimit {
  windowMs: number;
  /** Requests allowed per client per window. */
  limit: number;
}

/** Failed logins only; a successful login does not count against it. */
export const LOGIN_RATE_LIMIT: RateLimit = {
  windowMs: 15 * 60 * 1000,
  limit: 10,
};

/**
 * The public card endpoint. Generous on purpose: at a venue many students
 * share one Wi-Fi address, so a tight per-address limit would lock them out.
 */
export const CARD_RATE_LIMIT: RateLimit = { windowMs: 60 * 1000, limit: 120 };

/**
 * A valid bcrypt hash of a throwaway password. Login checks a submitted
 * password against it when the username does not exist, so a wrong username
 * takes as long as a wrong password and accounts cannot be told apart by timing.
 * Same cost (10) as the hashes the SQL cookbook creates.
 */
export const TIMING_DUMMY_HASH =
  "$2a$10$hOufJAiyJgXPsdmPuFVxN.Klzr4E2c/GYUdyW3oDxOE/AIW9kinHy";
