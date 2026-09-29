import {
  abortAfter,
  getGetCurrentStaffQueryKey,
  getGetRosterQueryKey,
  submitScans,
  undoCheckIn,
} from "@workspace/api-client-react";
import { SCAN_TIMEOUT_MS, STORAGE_KEYS } from "@/config";
import { isOnline, reportReachable } from "@/lib/network";
import { queryClient } from "@/lib/queryClient";
import { appStorage } from "@/lib/storage";
import { exclusiveAcrossTabs } from "./lock";
import { createOutbox } from "./outbox";
import { foldIntoRoster } from "./roster";
import { submitScan, submitUndo, type ScanInput } from "./submit";
import { createSyncEngine } from "./sync";

/**
 * A scan or undo a person is waiting on counts as "no connection" after
 * SCAN_TIMEOUT_MS, so the screen answers quickly. A background send may take
 * as long as any request: a long backlog is slow to record, and giving up on
 * it early would only make it start over.
 */
async function bounded<T>(
  signal: AbortSignal,
  interactive: boolean,
  request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!interactive) return request(signal);
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
    submitScans: async (scans, signal, interactive) =>
      (
        await bounded(signal, interactive, (limited) =>
          submitScans({ scans }, { signal: limited }),
        )
      ).results,
    // The generated URL builders do not escape path parameters; IDs may contain "/".
    undoCheckIn: (eventId, studentId, signal, interactive) =>
      bounded(signal, interactive, (limited) =>
        undoCheckIn(
          encodeURIComponent(eventId),
          encodeURIComponent(studentId),
          { signal: limited },
        ),
      ),
  },
  hooks: {
    onRegistrations: (registrations) =>
      foldIntoRoster(queryClient, registrations),
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
