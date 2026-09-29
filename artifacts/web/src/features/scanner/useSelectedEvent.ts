import { useState } from "react";
import { STORAGE_KEYS } from "@/config";
import type { Event } from "@/domain/roster";
import { appStorage } from "@/lib/storage";

export interface SelectedEvent {
  /** The event being scanned for; undefined when none is open. */
  eventId: string | undefined;
  choose: (eventId: string) => void;
  /**
   * The event that was being scanned for but is no longer open, so another was
   * picked for you; null when nothing like that happened (or after you choose).
   */
  replaced: string | null;
}

/**
 * The event being scanned for. Remembered on the device, so a scanner that is
 * reopened keeps pointing at the same event; falls back to the first open one
 * when the remembered event is gone or closed, and says so (`replaced`), so no
 * one keeps scanning into a different event without noticing.
 */
export function useSelectedEvent(openEvents: readonly Event[]): SelectedEvent {
  const [remembered, setRemembered] = useState(() =>
    appStorage.getItem(STORAGE_KEYS.selectedEvent),
  );

  const stillOpen = openEvents.some((e) => e.id === remembered);
  const eventId = stillOpen ? (remembered ?? undefined) : openEvents[0]?.id;

  function choose(chosen: string) {
    setRemembered(chosen);
    appStorage.setItem(STORAGE_KEYS.selectedEvent, chosen);
  }

  return {
    eventId,
    choose,
    replaced: remembered && !stillOpen && eventId ? remembered : null,
  };
}
