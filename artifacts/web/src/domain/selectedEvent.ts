import type { Event } from "./roster";

/**
 * Which event to scan for, given the one remembered on this device and the
 * events open now: the remembered one while it is open, otherwise the first
 * open one, with `replaced` naming the remembered event that was passed over so
 * no one keeps scanning into a different event without noticing.
 */
export function resolveSelectedEvent(
  openEvents: readonly Event[],
  remembered: string | null,
): { eventId: string | undefined; replaced: string | null } {
  const stillOpen = openEvents.some((event) => event.id === remembered);
  const eventId = stillOpen ? (remembered ?? undefined) : openEvents[0]?.id;
  return {
    eventId,
    replaced: remembered && !stillOpen && eventId ? remembered : null,
  };
}
