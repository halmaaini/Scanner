/**
 * A change this device has made but the server may not have seen yet.
 * Everything a scanner writes (a check-in, an undo) is one of these, queued in
 * the outbox and sent in order; there is no second path for "online" writes.
 */
export interface ScanOp {
  type: "scan";
  /** Client-generated; the server echoes it back so answers can be matched up. */
  id: string;
  studentId: string;
  eventId: string;
  /** When the scan physically happened (ISO 8601). */
  scannedAt: string;
  /** Who made it; only that person's session may send it. */
  staffId: number;
}

export interface UndoOp {
  type: "undo";
  id: string;
  studentId: string;
  eventId: string;
  staffId: number;
}

export type PendingOp = ScanOp | UndoOp;
