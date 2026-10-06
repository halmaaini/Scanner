import { useState } from "react";
import type { Roster } from "@/domain/roster";
import { useCurrentStaff } from "@/features/auth/StaffContext";
import { describeResult } from "@/features/scanner/describeResult";
import { m } from "@/messages";
import { scanning } from "@/offline";

/**
 * Checks a student in from a list or from the seat plan: the same path as a
 * scan at the door (so it works offline too), with a short message afterwards.
 */
export function useListCheckIn(view: Roster | undefined, eventId?: string) {
  const staff = useCurrentStaff();
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function checkIn(studentId: string, name: string) {
    if (!view || !eventId || checkingIn) return;
    setCheckingIn(studentId);
    try {
      const response = await scanning.scan({
        raw: studentId,
        eventId,
        staffId: staff.id,
        view,
      });
      if (!response || response.kind === "unavailable") {
        setNotice(m.scanner.noRosterOffline);
      } else {
        const { title, offlineNote } = describeResult({
          result: response.result,
          offline: response.kind === "offline",
          eventName: view.events.find((e) => e.id === eventId)?.name ?? eventId,
          staffName: () => undefined,
        });
        setNotice(
          [`${name}: ${title}`, offlineNote].filter(Boolean).join(". "),
        );
      }
    } catch {
      setNotice(m.scanner.scanFailed);
    } finally {
      setCheckingIn(null);
    }
  }

  return { checkIn, checkingIn, notice, clearNotice: () => setNotice(null) };
}
