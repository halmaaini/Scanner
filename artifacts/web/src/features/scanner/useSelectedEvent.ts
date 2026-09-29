import { useState } from "react";
import { STORAGE_KEYS } from "@/config";
import type { Event } from "@/domain/roster";
import { appStorage } from "@/lib/storage";

/**
 * The event being scanned for. Remembered on the device, so a scanner that is
 * reopened keeps pointing at the same event; falls back to the first open one
 * when the remembered event is gone or closed.
 */
export function useSelectedEvent(
  openEvents: readonly Event[],
): [string | undefined, (eventId: string) => void] {
  const [remembered, setRemembered] = useState(() =>
    appStorage.getItem(STORAGE_KEYS.selectedEvent),
  );

  const selected = openEvents.some((e) => e.id === remembered)
    ? (remembered ?? undefined)
    : openEvents[0]?.id;

  function select(eventId: string) {
    setRemembered(eventId);
    appStorage.setItem(STORAGE_KEYS.selectedEvent, eventId);
  }

  return [selected, select];
}
