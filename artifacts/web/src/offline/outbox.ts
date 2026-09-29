import type { ScanOutcome } from "@workspace/api-client-react";
import type { PendingOp } from "@/domain/ops";
import type { KeyValueStore } from "@/lib/storage";

/** Why a change could not be saved: the server's verdict, or a client-side reason. */
export type IssueReason = ScanOutcome | "invalid" | "undo_forbidden";

/** A change the server refused. Kept so the person can see what did not go through. */
export interface SyncIssue {
  op: PendingOp;
  reason: IssueReason;
  /** When it was given up on (ISO 8601). */
  at: string;
}

export interface OutboxState {
  /** Changes waiting to be sent, oldest first. */
  readonly ops: readonly PendingOp[];
  readonly issues: readonly SyncIssue[];
}

export interface Outbox {
  /** The same object until something changes (safe for useSyncExternalStore). */
  getState(): OutboxState;
  subscribe(listener: () => void): () => void;
  add(op: PendingOp): void;
  /**
   * Takes answered operations off the queue and records the ones that failed,
   * in one write, so a crash cannot lose an issue between the two.
   */
  settle(answeredIds: readonly string[], issues?: readonly SyncIssue[]): void;
  dismissIssues(): void;
  clear(): void;
}

const EMPTY: OutboxState = { ops: [], issues: [] };

function isOp(value: unknown): value is PendingOp {
  if (typeof value !== "object" || value === null) return false;
  const op = value as Record<string, unknown>;
  const base =
    typeof op.id === "string" &&
    typeof op.studentId === "string" &&
    typeof op.eventId === "string" &&
    typeof op.staffId === "number";
  if (!base) return false;
  return (
    op.type === "undo" ||
    (op.type === "scan" && typeof op.scannedAt === "string")
  );
}

function isIssue(value: unknown): value is SyncIssue {
  if (typeof value !== "object" || value === null) return false;
  const issue = value as Record<string, unknown>;
  return (
    isOp(issue.op) &&
    typeof issue.reason === "string" &&
    typeof issue.at === "string"
  );
}

function parse(raw: string | null): OutboxState {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as { ops?: unknown; issues?: unknown };
    return {
      ops: Array.isArray(data.ops) ? data.ops.filter(isOp) : [],
      issues: Array.isArray(data.issues) ? data.issues.filter(isIssue) : [],
    };
  } catch {
    return EMPTY;
  }
}

/**
 * The queue of changes this device has made but the server may not have.
 * It is saved on every change so nothing is lost if the tab is closed, the
 * phone restarts or the battery dies, and it follows changes made in another
 * tab of the app.
 */
export function createOutbox(storage: KeyValueStore, key: string): Outbox {
  let state = parse(storage.getItem(key));
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  /** Applies a change on top of what is stored right now (another tab may have written). */
  function update(change: (current: OutboxState) => OutboxState): void {
    const next = change(parse(storage.getItem(key)));
    state = next;
    if (next.ops.length === 0 && next.issues.length === 0) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify(next));
    }
    notify();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === key || event.key === null) {
        state = parse(storage.getItem(key));
        notify();
      }
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    add: (op) => update((s) => ({ ...s, ops: [...s.ops, op] })),
    settle(answeredIds, issues = []) {
      const answered = new Set(answeredIds);
      update((s) => ({
        ops: s.ops.filter((op) => !answered.has(op.id)),
        issues: [...s.issues, ...issues],
      }));
    },
    dismissIssues: () => update((s) => ({ ...s, issues: [] })),
    clear: () => update(() => EMPTY),
  };
}
