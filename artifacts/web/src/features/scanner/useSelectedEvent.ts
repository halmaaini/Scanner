import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/config";
import type { Event } from "@/domain/roster";
import { resolveSelectedEvent } from "@/domain/selectedEvent";
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
 * when the remembered event is gone or closed, and says so (`replaced`).
 */
export function useSelectedEvent(openEvents: readonly Event[]): SelectedEvent {
  const [remembered, setRemembered] = useState(() =>
    appStorage.getItem(STORAGE_KEYS.selectedEvent),
  );
  const { eventId, replaced } = resolveSelectedEvent(openEvents, remembered);

  const choose = useCallback((chosen: string) => {
    setRemembered(chosen);
    appStorage.setItem(STORAGE_KEYS.selectedEvent, chosen);
  }, []);

  // Nothing was ever chosen, so the first open event is in use. Remember it
  // like a choice: when it closes, that is then noticed too.
  useEffect(() => {
    if (remembered === null && eventId) choose(eventId);
  }, [remembered, eventId, choose]);

  return { eventId, choose, replaced };
}
