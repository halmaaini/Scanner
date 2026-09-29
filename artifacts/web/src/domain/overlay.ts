import type { PendingOp } from "./ops";
import { rowKey, type Registration, type Roster } from "./roster";

/**
 * The roster as this device sees it: what the server last said, with this
 * device's unsent changes laid on top, in order. Every screen and every
 * offline judgement reads this view, so a scan made a second ago (even with no
 * connection) is already reflected in counts, lists and repeat detection.
 */
export function applyPendingOps(
  roster: Roster,
  ops: readonly PendingOp[],
): Roster {
  if (ops.length === 0) return roster;

  const rows = new Map<string, Registration>(
    roster.registrations.map((r) => [rowKey(r.studentId, r.eventId), r]),
  );

  for (const op of ops) {
    const key = rowKey(op.studentId, op.eventId);
    const row = rows.get(key);
    if (!row) continue;

    if (op.type === "scan") {
      if (!row.checkedInAt) {
        rows.set(key, {
          ...row,
          checkedInAt: op.scannedAt,
          checkedInBy: op.staffId,
        });
      }
    } else if (row.checkedInAt) {
      rows.set(key, { ...row, checkedInAt: null, checkedInBy: null });
    }
  }

  return { ...roster, registrations: [...rows.values()] };
}
