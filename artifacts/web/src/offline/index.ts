import {
  getGetCurrentStaffQueryKey,
  getGetRosterQueryKey,
  submitScans,
  undoCheckIn,
  type Roster,
} from "@workspace/api-client-react";
import { REQUEST_TIMEOUT_MS, STORAGE_KEYS } from "@/config";
import { replaceRegistrations } from "@/domain/roster";
import { reportReachable } from "@/lib/network";
import { queryClient } from "@/lib/queryClient";
import { appStorage } from "@/lib/storage";
import { createOutbox } from "./outbox";
import { submitScan, submitUndo, type ScanInput } from "./submit";
import { createSyncEngine } from "./sync";

/** A request that hangs (a weak signal) is treated as "no connection". */
async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** This device's unsent changes, kept across reloads. */
export const outbox = createOutbox(appStorage, STORAGE_KEYS.outbox);

export const syncEngine = createSyncEngine({
  outbox,
  api: {
    submitScans: async (scans) =>
      (await withTimeout((signal) => submitScans({ scans }, { signal })))
        .results,
    // The generated URL builders do not escape path parameters; IDs may contain "/".
    undoCheckIn: (eventId, studentId) =>
      withTimeout((signal) =>
        undoCheckIn(
          encodeURIComponent(eventId),
          encodeURIComponent(studentId),
          { signal },
        ),
      ),
  },
  hooks: {
    onRegistrations: (registrations) =>
      queryClient.setQueryData<Roster>(
        getGetRosterQueryKey(),
        (roster) => roster && replaceRegistrations(roster, registrations),
      ),
    onStale: () =>
      void queryClient.invalidateQueries({ queryKey: getGetRosterQueryKey() }),
    onUnauthorized: () =>
      void queryClient.invalidateQueries({
        queryKey: getGetCurrentStaffQueryKey(),
      }),
    onReachable: reportReachable,
  },
});

/** What screens call to write: every scan and undo goes through here. */
export const scanning = {
  scan: (input: ScanInput) => submitScan({ outbox, engine: syncEngine }, input),
  undo: (input: { studentId: string; eventId: string; staffId: number }) =>
    submitUndo({ outbox, engine: syncEngine }, input),
};
