/**
 * Longest free text the API accepts for a student's note and an event's venue
 * and map link. The database refuses longer ones; the API spec's `maxLength`
 * must match (a server test checks it).
 */
export const MAX_NOTE_LENGTH = 300;
export const MAX_VENUE_LENGTH = 200;
export const MAX_MAP_URL_LENGTH = 500;
