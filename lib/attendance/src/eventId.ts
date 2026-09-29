/**
 * Longest event id (the short slug in `events.id`) the API accepts. The
 * database refuses longer ones, so an event can always be scanned for and
 * undone. The API spec's `maxLength` must match; a server test checks it.
 */
export const MAX_EVENT_ID_LENGTH = 64;
