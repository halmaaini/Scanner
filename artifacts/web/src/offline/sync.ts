import type {
  Registration,
  Scan,
  ScanResult,
} from "@workspace/api-client-react";
import { isRecorded, MAX_SCANS_PER_REQUEST } from "@workspace/attendance";
import type { PendingOp, ScanOp } from "@/domain/ops";
import { isNetworkError, isUnauthorized, statusOf } from "@/lib/errors";
import type { IssueReason, Outbox, SyncIssue } from "./outbox";

/** The two calls the engine makes. Real ones add a timeout (see index.ts). */
export interface SyncApi {
  submitScans(scans: Scan[], signal: AbortSignal): Promise<ScanResult[]>;
  undoCheckIn(
    eventId: string,
    studentId: string,
    signal: AbortSignal,
  ): Promise<Registration>;
}

/** How the engine reports back to the rest of the app. */
export interface SyncHooks {
  /**
   * Rows the server confirmed; fold them into the saved roster. The engine
   * waits for this before it lets go of the changes they came from.
   */
  onRegistrations(registrations: Registration[]): void | Promise<void>;
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
  /** The last attempt reached the server, which failed on its own end. */
  serverProblem: boolean;
}

export interface SyncEngine {
  /**
   * Sends every waiting change made by `staffId`, oldest first, in the
   * background. Never rejects: whatever could not be sent (no connection,
   * server trouble) simply stays queued for the next attempt. Asking again
   * while a send is under way (or waiting its turn) adds no extra request.
   */
  flush(staffId: number): Promise<void>;
  /**
   * Sends a change (already added to the outbox) that someone is waiting on,
   * and resolves with the server's answer, or with undefined when there was
   * none to be had (no connection): the change then stays queued, and the
   * caller shows what it can work out for itself. A server refusal is handed
   * to the caller instead of being filed as an "issue".
   *
   * While the server is known to be out of reach this does not wait for the
   * network at all; the background send keeps trying.
   */
  send(op: PendingOp): Promise<OpAnswer | undefined>;
  /**
   * Takes a change back off the queue, if it has not gone (or started going)
   * to the server. Returns whether it did; if not, the change stands.
   */
  cancel(opId: string): boolean;
  getStatus(): SyncStatus;
  subscribe(listener: () => void): () => void;
}

interface Deps {
  outbox: Outbox;
  api: SyncApi;
  hooks: SyncHooks;
  /** Whether the server is believed reachable right now. Default: always. */
  isReachable?: () => boolean;
  /**
   * Runs a sending pass by itself, even across tabs and windows of the app
   * (two must not send the same queue). May skip it if another has it. Default: just run it.
   */
  exclusive?: (run: () => Promise<void>) => Promise<void>;
  now?: () => Date;
}

const toWire = (op: ScanOp): Scan => ({
  id: op.id,
  studentId: op.studentId,
  eventId: op.eventId,
  scannedAt: op.scannedAt,
});

/** Thrown out of a request that was called off because a person is waiting. */
const SUPERSEDED = new Error("superseded");

/** Applies queued changes to the server, in order, exactly as they were made. */
export function createSyncEngine({
  outbox,
  api,
  hooks,
  isReachable = () => true,
  exclusive = (run) => run(),
  now = () => new Date(),
}: Deps): SyncEngine {
  let status: SyncStatus = { syncing: false, serverProblem: false };
  const listeners = new Set<() => void>();

  /** Who is waiting on which change: keyed by the change, so any pass can answer. */
  const waiters = new Map<string, (answer: OpAnswer | undefined) => void>();
  /** Staff whose queues the next pass should send. */
  const wanted = new Set<number>();
  /** Changes in the request being sent right now. */
  const inFlight = new Set<string>();
  let flight:
    | { controller: AbortController; interactive: boolean; superseded: boolean }
    | undefined;
  let draining: Promise<void> | undefined;

  function setStatus(change: Partial<SyncStatus>): void {
    const next = { ...status, ...change };
    if (
      next.syncing === status.syncing &&
      next.serverProblem === status.serverProblem
    ) {
      return;
    }
    status = next;
    listeners.forEach((listener) => listener());
  }

  /** Tells whoever waits on `id` (once) what came of it. */
  function answer(id: string, value: OpAnswer | undefined): void {
    const resolve = waiters.get(id);
    if (!resolve) return;
    waiters.delete(id);
    resolve(value);
  }

  /** One request, which a person's scan may call off if it is only background work. */
  async function request<T>(
    ops: readonly PendingOp[],
    call: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const current = {
      controller: new AbortController(),
      interactive: ops.some((op) => waiters.has(op.id)),
      superseded: false,
    };
    flight = current;
    ops.forEach((op) => inFlight.add(op.id));
    try {
      return await call(current.controller.signal);
    } catch (error) {
      throw current.superseded ? SUPERSEDED : error;
    } finally {
      flight = undefined;
      ops.forEach((op) => inFlight.delete(op.id));
    }
  }

  /** Sends what `staffId` has waiting. Stops at the first thing it cannot send. */
  async function sendAll(staffId: number): Promise<void> {
    outbox.refresh();
    const waiting = outbox
      .getState()
      .ops.filter((op) => op.staffId === staffId);
    let stale = false;
    // After the server cannot read a request, scans go one per request so the
    // one it cannot read does not take the others down with it.
    let oneAtATime = false;

    /** Files a failure for later, unless someone is waiting and is told directly. */
    const fail = (op: PendingOp, reason: IssueReason): SyncIssue[] =>
      waiters.has(op.id) ? [] : [{ op, reason, at: now().toISOString() }];

    try {
      let i = 0;
      while (i < waiting.length) {
        const op = waiting[i]!;

        if (op.type === "scan") {
          const batch: ScanOp[] = [];
          const limit = oneAtATime ? 1 : MAX_SCANS_PER_REQUEST;
          while (
            i + batch.length < waiting.length &&
            batch.length < limit &&
            waiting[i + batch.length]!.type === "scan"
          ) {
            batch.push(waiting[i + batch.length] as ScanOp);
          }

          let results: ScanResult[];
          try {
            results = await request(batch, (signal) =>
              api.submitScans(batch.map(toWire), signal),
            );
          } catch (error) {
            if (statusOf(error) !== 400) throw error;
            if (batch.length > 1) {
              oneAtATime = true;
              continue;
            }
            // One scan the server cannot read and never will: do not retry it forever.
            outbox.settle([op.id], fail(op, "invalid"));
            answer(op.id, { kind: "rejected", reason: "invalid" });
            i += 1;
            continue;
          }

          const byId = new Map(results.map((r) => [r.id, r]));
          const answered: ScanResult[] = [];
          const issues: SyncIssue[] = [];
          for (const scan of batch) {
            const result = byId.get(scan.id);
            if (!result) continue;
            answered.push(result);
            if (!isRecorded(result.outcome)) {
              stale = true;
              issues.push(...fail(scan, result.outcome));
            }
          }
          // The server's rows go into the saved roster *before* the queue lets
          // go of these scans, so no screen ever sees them in neither place
          // (the count would dip and jump back).
          await hooks.onRegistrations(
            answered.flatMap((r) => (r.registration ? [r.registration] : [])),
          );
          outbox.settle(
            answered.map((r) => r.id),
            issues,
          );
          answered.forEach((result) =>
            answer(result.id, { kind: "scan", result }),
          );
          i += batch.length;
        } else {
          try {
            const registration = await request([op], (signal) =>
              api.undoCheckIn(op.eventId, op.studentId, signal),
            );
            await hooks.onRegistrations([registration]);
            outbox.settle([op.id]);
            answer(op.id, { kind: "undo", registration });
          } catch (error) {
            const code = statusOf(error);
            if (code === 404) {
              // No such registration: there is nothing left to undo.
              outbox.settle([op.id]);
              answer(op.id, { kind: "undo", registration: null });
            } else if (code === 403) {
              outbox.settle([op.id], fail(op, "undo_forbidden"));
              answer(op.id, { kind: "rejected", reason: "undo_forbidden" });
            } else {
              throw error;
            }
          }
          i += 1;
        }
      }
      hooks.onReachable(true);
      setStatus({ serverProblem: false });
    } catch (error) {
      // Stop here; everything not yet answered stays queued for the next attempt.
      if (error === SUPERSEDED) return;
      if (isUnauthorized(error)) {
        hooks.onUnauthorized();
      } else {
        const reached = !isNetworkError(error);
        hooks.onReachable(reached);
        setStatus({ serverProblem: reached });
      }
    } finally {
      if (stale) hooks.onStale();
    }
  }

  async function pass(staffId: number): Promise<void> {
    const snapshot = outbox
      .getState()
      .ops.filter((op) => op.staffId === staffId);
    if (snapshot.length === 0) return;

    setStatus({ syncing: true });
    try {
      await exclusive(() => sendAll(staffId));
    } finally {
      // Whatever was not answered for whatever reason ends the wait.
      snapshot.forEach((op) => answer(op.id, undefined));
      setStatus({ syncing: false });
    }
  }

  /** Runs passes until nobody is asking for another. */
  function start(): Promise<void> {
    draining ??= (async () => {
      // Lets `start` record the promise first, so it can clear it below.
      await Promise.resolve();
      try {
        while (wanted.size > 0) {
          const staffId = wanted.values().next().value as number;
          wanted.delete(staffId);
          try {
            await pass(staffId);
          } catch (error) {
            console.error("Sending saved changes failed", error);
          }
        }
      } finally {
        draining = undefined;
      }
    })();
    return draining;
  }

  return {
    flush(staffId) {
      wanted.add(staffId);
      return start();
    },
    send(op) {
      const answered = new Promise<OpAnswer | undefined>((resolve) =>
        waiters.set(op.id, resolve),
      );
      wanted.add(op.staffId);
      // Background work that is still on the wire only delays this: call it
      // off, its changes stay queued and go out again in the next pass.
      if (flight && !flight.interactive) {
        flight.superseded = true;
        flight.controller.abort();
      }
      void start();
      if (!isReachable()) answer(op.id, undefined);
      return answered;
    },
    cancel(opId) {
      const queued = outbox.getState().ops.some((op) => op.id === opId);
      if (!queued || inFlight.has(opId)) return false;
      outbox.settle([opId]);
      answer(opId, undefined);
      return true;
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
