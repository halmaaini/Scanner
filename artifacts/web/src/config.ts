/** Tunables in one place. Text lives in messages.ts. */

/** How times and dates are written everywhere (24-hour, day before month). */
export const LOCALE = "en-GB";

/**
 * Bump when the shape of cached API data changes, so phones that saved the
 * old shape throw it away instead of misreading it.
 */
export const CACHE_VERSION = "1";
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Saved server answers are treated as fresh for this long; the page reopened later re-reads them. */
export const QUERY_STALE_MS = 10_000;

/** Who is signed in is re-checked after this long when the page is refocused. */
export const STAFF_STALE_MS = 60_000;

/** How often the saved copy of server answers is written to the device (at most). */
export const PERSIST_THROTTLE_MS = 1_000;

/** A failed read is tried once more before it is reported. */
export const QUERY_RETRIES = 1;

/** A student's card is re-read after this long when the page is reopened or refocused. */
export const CARD_STALE_MS = 30_000;

/** Most students offered to choose from when an ID typed at the scanner is only part of one. */
export const TYPED_ID_CHOICES = 8;

/** How often an open screen re-reads the roster (only while visible and online). */
export const ROSTER_POLL_MS = 30_000;

/** How often an app that stays open looks for a new version of itself. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** How often unsent scans are retried while any are waiting. */
export const SYNC_INTERVAL_MS = 10_000;

/** Any request slower than this fails instead of hanging (student list, sign-in, ...). */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * A scan or undo that a person is waiting on, slower than this, counts as "no
 * connection": it stays queued and the person sees the offline answer. Short,
 * because someone is waiting; background sends get REQUEST_TIMEOUT_MS.
 */
export const SCAN_TIMEOUT_MS = 5_000;

/** The camera reads codes at most this many times a second: plenty, and easy on the battery. */
export const CAMERA_SCANS_PER_SECOND = 8;

/**
 * After a result is dismissed, the same code, if it is still in front of the
 * camera, is ignored for this long instead of being scanned again at once.
 */
export const SAME_CODE_COOLDOWN_MS = 2_000;

/** How long a short message stays at the bottom of the screen. */
export const NOTICE_MS = 4_500;

/** How long a downloaded file is kept available to the browser before it is released. */
export const RELEASE_DOWNLOAD_MS = 60_000;

/** How many problems the "couldn't be saved" banner lists before "…and N more". */
export const LISTED_ISSUES = 5;

/** The browser lock that lets one tab or window at a time send the saved changes. */
export const SYNC_LOCK_NAME = "scanner.sync";

/** Where things are kept in the browser. */
export const STORAGE_KEYS = {
  queryCache: "scanner.cache",
  outbox: "scanner.outbox",
  selectedEvent: "scanner.event",
} as const;

/**
 * The procession on the student's card: about `secs` until everyone is
 * seated, then `holdSecs` of slow close-up on the student's seat and a
 * `tossSecs` cap toss. `speed` is in plan pixels per second.
 */
export const PROCESSION = {
  secs: 20,
  holdSecs: 3,
  tossSecs: 2,
  speed: 132,
  forwardSecs: 5,
} as const;
