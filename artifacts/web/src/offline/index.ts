import {
  abortAfter,
  getGetCurrentStaffQueryKey,
  getGetRosterQueryKey,
  submitScans,
  undoCheckIn,
  type Roster,
} from "@workspace/api-client-react";
import { SCAN_TIMEOUT_MS, STORAGE_KEYS } from "@/config";
import { replaceRegistrations } from "@/domain/roster";
import { isOnline, reportReachable } from "@/lib/network";
import { queryClient } from "@/lib/queryClient";
import { appStorage } from "@/lib/storage";
import { exclusiveAcrossTabs } from "./lock";
import { createOutbox } from "./outbox";
import { submitScan, submitUndo, type ScanInput } from "./submit";
import { createSyncEngine } from "./sync";

/** A scan or undo slower than SCAN_TIMEOUT_MS is treated as "no connection". */
async function bounded<T>(
  signal: AbortSignal,
  request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const limited = abortAfter(SCAN_TIMEOUT_MS, signal);
  try {
    return await request(limited.signal);
  } finally {
    limited.cleanup();
  }
}

/** This device's unsent changes, kept across reloads. */
export const outbox = createOutbox(appStorage, STORAGE_KEYS.outbox);

export const syncEngine = createSyncEngine({
  outbox,
  api: {
    submitScans: async (scans, signal) =>
      (
        await bounded(signal, (limited) =>
          submitScans({ scans }, { signal: limited }),
        )
      ).results,
    // The generated URL builders do not escape path parameters; IDs may contain "/".
    undoCheckIn: (eventId, studentId, signal) =>
      bounded(signal, (limited) =>
        undoCheckIn(
          encodeURIComponent(eventId),
          encodeURIComponent(studentId),
          { signal: limited },
        ),
      ),
  },
  hooks: {
    onRegistrations: async (registrations) => {
      const key = getGetRosterQueryKey();
      // A roster read that began before these answers came back would land
      // after them and put the old rows back; call it off first.
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Roster>(
        key,
        (roster) => roster && replaceRegistrations(roster, registrations),
      );
    },
    onStale: () =>
      void queryClient.invalidateQueries({ queryKey: getGetRosterQueryKey() }),
    onUnauthorized: () =>
      void queryClient.invalidateQueries({
        queryKey: getGetCurrentStaffQueryKey(),
      }),
    onReachable: reportReachable,
  },
  isReachable: isOnline,
  exclusive: exclusiveAcrossTabs,
});

/** What screens call to write: every scan and undo goes through here. */
export const scanning = {
  scan: (input: ScanInput) => submitScan({ outbox, engine: syncEngine }, input),
  undo: (input: {
    studentId: string;
    eventId: string;
    staffId: number;
    scanOpId?: string;
  }) => submitUndo({ outbox, engine: syncEngine }, input),
};
