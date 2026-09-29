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
  /** Re-reads what is saved, in case another tab of the app changed it. */
  refresh(): void;
  add(op: PendingOp): void;
  /**
   * Takes answered operations off the queue and records the ones that failed,
   * in one write, so a crash cannot lose an issue between the two.
   */
  settle(answeredIds: readonly string[], issues?: readonly SyncIssue[]): void;
  /** Forgets one person's issues; other people's stay until they see them. */
  dismissIssues(staffId: number): void;
}

const EMPTY: OutboxState = { ops: [], issues: [] };

/**
 * Bump when the saved shape changes, and teach `parse` to read the old one:
 * a phone that updates with unsent check-ins must not lose them.
 */
const FORMAT_VERSION = 1;

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

/**
 * Reads the saved state. Anything that cannot be understood (damaged data, a
 * newer format) is handed to `keep` instead of being thrown away silently.
 */
function parse(
  raw: string | null,
  keep: (unreadable: string) => void,
): OutboxState {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as {
      version?: unknown;
      ops?: unknown;
      issues?: unknown;
    };
    if (data.version === FORMAT_VERSION) {
      const ops = Array.isArray(data.ops) ? data.ops : [];
      const issues = Array.isArray(data.issues) ? data.issues : [];
      const state = { ops: ops.filter(isOp), issues: issues.filter(isIssue) };
      if (
        state.ops.length !== ops.length ||
        state.issues.length !== issues.length
      ) {
        keep(raw);
      }
      return state;
    }
  } catch {
    // Not JSON: treated like any other unreadable data, below.
  }
  keep(raw);
  return EMPTY;
}

/**
 * The queue of changes this device has made but the server may not have.
 * It is saved on every change so nothing is lost if the tab is closed, the
 * phone restarts or the battery dies, and it follows changes made in another
 * tab of the app.
 */
export function createOutbox(storage: KeyValueStore, key: string): Outbox {
  const unreadableKey = `${key}.unreadable`;
  const keep = (unreadable: string) => {
    console.warn(
      `Saved changes could not be read; kept under ${unreadableKey}`,
    );
    storage.setItem(unreadableKey, unreadable);
  };

  let saved = storage.getItem(key);
  let state = parse(saved, keep);
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  /** Applies a change on top of what is stored right now (another tab may have written). */
  function update(change: (current: OutboxState) => OutboxState): void {
    const next = change(parse(storage.getItem(key), keep));
    state = next;
    if (next.ops.length === 0 && next.issues.length === 0) {
      saved = null;
      storage.removeItem(key);
    } else {
      saved = JSON.stringify({
        version: FORMAT_VERSION,
        ops: next.ops,
        issues: next.issues,
      });
      storage.setItem(key, saved);
    }
    notify();
  }

  function refresh(): void {
    const current = storage.getItem(key);
    if (current === saved) return;
    saved = current;
    state = parse(current, keep);
    notify();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === key || event.key === null) refresh();
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    refresh,
    add: (op) => update((s) => ({ ...s, ops: [...s.ops, op] })),
    settle(answeredIds, issues = []) {
      const answered = new Set(answeredIds);
      update((s) => ({
        ops: s.ops.filter((op) => !answered.has(op.id)),
        issues: [...s.issues, ...issues],
      }));
    },
    dismissIssues: (staffId) =>
      update((s) => ({
        ...s,
        issues: s.issues.filter((issue) => issue.op.staffId !== staffId),
      })),
  };
}
