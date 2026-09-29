import type {
  Registration,
  Scan,
  ScanResult,
} from "@workspace/api-client-react";
import { MAX_SCANS_PER_REQUEST } from "@workspace/attendance";
import type { PendingOp, ScanOp } from "@/domain/ops";
import { isNetworkError, isUnauthorized, statusOf } from "@/lib/errors";
import type { IssueReason, Outbox, SyncIssue } from "./outbox";

/** The two calls the engine makes. Real ones add a timeout (see index.ts). */
export interface SyncApi {
  submitScans(scans: Scan[]): Promise<ScanResult[]>;
  undoCheckIn(eventId: string, studentId: string): Promise<Registration>;
}

/** How the engine reports back to the rest of the app. */
export interface SyncHooks {
  /** Rows the server confirmed; fold them into the saved roster. */
  onRegistrations(registrations: Registration[]): void;
  /** An answer suggests the saved roster is out of date; refresh it. */
  onStale(): void;
  /** The session ended; ask who is signed in again. */
  onUnauthorized(): void;
  /** Whether the server could be reached on this attempt. */
  onReachable(reachable: boolean): void;
}

/** What the server said about one operation, for whoever is waiting on it. */
export type OpAnswer =
  | { kind: "scan"; result: ScanResult }
  | { kind: "undo"; registration: Registration | null }
  | { kind: "rejected"; reason: IssueReason };

export interface SyncStatus {
  syncing: boolean;
}

export interface SyncEngine {
  /**
   * Sends every waiting change made by `staffId`, oldest first, and resolves
   * with the server's answer for each one it got. Never rejects: whatever could
   * not be sent (no connection, server trouble) simply stays queued for the
   * next attempt. Calls are queued, so two callers never send at once.
   *
   * `interactiveId` is the change someone is waiting on: its answer is handed
   * back to them instead of being filed as an "issue" if the server refuses it.
   */
  flush(
    staffId: number,
    interactiveId?: string,
  ): Promise<Map<string, OpAnswer>>;
  getStatus(): SyncStatus;
  subscribe(listener: () => void): () => void;
}

interface Deps {
  outbox: Outbox;
  api: SyncApi;
  hooks: SyncHooks;
  now?: () => Date;
}

/** The server judged the scan and either recorded it or knew it already had. */
const isRecorded = (result: ScanResult) =>
  result.outcome === "checked_in" || result.outcome === "already_checked_in";

const toWire = (op: ScanOp): Scan => ({
  id: op.id,
  studentId: op.studentId,
  eventId: op.eventId,
  scannedAt: op.scannedAt,
});

/** Applies queued changes to the server, in order, exactly as they were made. */
export function createSyncEngine({
  outbox,
  api,
  hooks,
  now = () => new Date(),
}: Deps): SyncEngine {
  let status: SyncStatus = { syncing: false };
  const listeners = new Set<() => void>();
  let queue: Promise<unknown> = Promise.resolve();

  function setSyncing(syncing: boolean): void {
    status = { syncing };
    listeners.forEach((listener) => listener());
  }

  function issue(op: PendingOp, reason: IssueReason): SyncIssue {
    return { op, reason, at: now().toISOString() };
  }

  async function run(
    staffId: number,
    interactiveId: string | undefined,
  ): Promise<Map<string, OpAnswer>> {
    const answers = new Map<string, OpAnswer>();
    const waiting = outbox
      .getState()
      .ops.filter((op) => op.staffId === staffId);
    if (waiting.length === 0) return answers;

    setSyncing(true);
    let stale = false;

    /** Files a failure for later unless someone is waiting on this very change. */
    const fail = (op: PendingOp, reason: IssueReason): SyncIssue[] =>
      op.id === interactiveId ? [] : [issue(op, reason)];

    try {
      let i = 0;
      while (i < waiting.length) {
        const op = waiting[i]!;

        if (op.type === "scan") {
          const batch: ScanOp[] = [];
          while (
            i + batch.length < waiting.length &&
            batch.length < MAX_SCANS_PER_REQUEST &&
            waiting[i + batch.length]!.type === "scan"
          ) {
            batch.push(waiting[i + batch.length] as ScanOp);
          }

          let results: ScanResult[];
          try {
            results = await api.submitScans(batch.map(toWire));
          } catch (error) {
            if (statusOf(error) === 400) {
              // The server cannot read these scans and never will: do not retry forever.
              batch.forEach((b) =>
                answers.set(b.id, { kind: "rejected", reason: "invalid" }),
              );
              outbox.settle(
                batch.map((b) => b.id),
                batch.flatMap((b) => fail(b, "invalid")),
              );
              i += batch.length;
              continue;
            }
            throw error;
          }

          const byId = new Map(results.map((r) => [r.id, r]));
          const answered: string[] = [];
          const confirmed: Registration[] = [];
          const issues: SyncIssue[] = [];
          for (const scan of batch) {
            const result = byId.get(scan.id);
            if (!result) continue;
            answered.push(scan.id);
            answers.set(scan.id, { kind: "scan", result });
            if (result.registration) confirmed.push(result.registration);
            if (!isRecorded(result)) {
              stale = true;
              issues.push(...fail(scan, result.outcome));
            }
          }
          // The server's rows go into the saved roster *before* the queue lets
          // go of these scans, so no screen ever sees them in neither place
          // (the count would dip and jump back).
          hooks.onRegistrations(confirmed);
          outbox.settle(answered, issues);
          i += batch.length;
        } else {
          try {
            const registration = await api.undoCheckIn(
              op.eventId,
              op.studentId,
            );
            answers.set(op.id, { kind: "undo", registration });
            hooks.onRegistrations([registration]);
            outbox.settle([op.id]);
          } catch (error) {
            const code = statusOf(error);
            if (code === 404) {
              // No such registration: there is nothing left to undo.
              answers.set(op.id, { kind: "undo", registration: null });
              outbox.settle([op.id]);
            } else if (code === 403) {
              answers.set(op.id, {
                kind: "rejected",
                reason: "undo_forbidden",
              });
              outbox.settle([op.id], fail(op, "undo_forbidden"));
            } else {
              throw error;
            }
          }
          i += 1;
        }
      }
      hooks.onReachable(true);
    } catch (error) {
      // Stop here; everything not yet answered stays queued for the next attempt.
      if (isUnauthorized(error)) {
        hooks.onUnauthorized();
      } else {
        hooks.onReachable(!isNetworkError(error));
      }
    } finally {
      if (stale) hooks.onStale();
      setSyncing(false);
    }
    return answers;
  }

  return {
    flush(staffId, interactiveId) {
      const result = queue.then(() => run(staffId, interactiveId));
      queue = result.catch(() => undefined);
      return result;
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
