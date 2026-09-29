/** Tunables in one place. Text lives in messages.ts. */

/** How times and dates are written everywhere (24-hour, day before month). */
export const LOCALE = "en-GB";

/**
 * Bump when the shape of cached API data changes, so phones that saved the
 * old shape throw it away instead of misreading it.
 */
export const CACHE_VERSION = "1";
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** How often an open screen re-reads the roster (only while visible and online). */
export const ROSTER_POLL_MS = 30_000;

/** How often unsent scans are retried while any are waiting. */
export const SYNC_INTERVAL_MS = 10_000;

/** A request slower than this counts as "offline" for the scan in hand. */
export const REQUEST_TIMEOUT_MS = 8_000;

/** Where things are kept in the browser. */
export const STORAGE_KEYS = {
  queryCache: "scanner.cache",
  outbox: "scanner.outbox",
  selectedEvent: "scanner.event",
} as const;
