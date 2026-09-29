import type { ScanOutcome, ScanResult } from "@workspace/api-client-react";
import { formatTime, formatWhen } from "@/lib/format";
import { m } from "@/messages";

/** One calm colour per kind of answer: green admit, amber note, red stop. */
export type Tone = "ok" | "warn" | "bad";

export interface ResultRow {
  label: string;
  value: string;
  /** Draw the value in the tone colour (used for the reason on a refusal). */
  emphasis?: boolean;
}

/** Everything the result screen shows, worked out from the server's answer. */
export interface ResultDescription {
  tone: Tone;
  title: string;
  name: string;
  idLine: string;
  rows: ResultRow[];
  /** Guidance for the person at the door. */
  note?: string;
  /** Set when the answer came from the saved list because the server was out of reach. */
  offlineNote?: string;
}

interface Context {
  result: ScanResult;
  /** True when this is the saved list's guess, not the server's answer. */
  offline: boolean;
  eventName: string;
  /** Looks up the name of the staff member with this id. */
  staffName: (id: number) => string | undefined;
}

interface Base {
  tone: Tone;
  title: string;
  note?: string;
}

/** The wording and colour of each outcome; the only place they are decided. */
const BASE: Record<ScanOutcome, Base> = {
  checked_in: { tone: "ok", title: m.results.checkedIn.title },
  already_checked_in: {
    tone: "warn",
    title: m.results.alreadyCheckedIn.title,
    note: m.results.alreadyCheckedIn.note,
  },
  revoked: {
    tone: "bad",
    title: m.results.revoked.title,
    note: m.results.revoked.note,
  },
  not_registered: {
    tone: "bad",
    title: m.results.notRegistered.title,
    note: m.results.notRegistered.note,
  },
  unknown_student: {
    tone: "bad",
    title: m.results.unknownStudent.title,
    note: m.results.unknownStudent.note,
  },
  unknown_event: {
    tone: "bad",
    title: m.results.unknownEvent.title,
    note: m.results.unknownEvent.note,
  },
};

function rowsFor({ result, eventName, staffName }: Context): ResultRow[] {
  const event: ResultRow = { label: m.results.event, value: eventName };
  const checkedInAt = result.registration?.checkedInAt;

  switch (result.outcome) {
    case "checked_in":
      return [
        event,
        ...(checkedInAt
          ? [{ label: m.results.time, value: formatTime(checkedInAt) }]
          : []),
      ];
    case "already_checked_in": {
      const by = result.registration?.checkedInBy;
      return [
        event,
        ...(checkedInAt
          ? [{ label: m.results.firstScan, value: formatWhen(checkedInAt) }]
          : []),
        {
          label: m.results.scannedBy,
          value:
            (by === null || by === undefined ? undefined : staffName(by)) ??
            m.results.someoneElse,
        },
      ];
    }
    case "revoked":
      return [
        {
          label: m.results.reason,
          value: m.results.revoked.reason,
          emphasis: true,
        },
        event,
      ];
    case "not_registered":
      return [
        {
          label: m.results.reason,
          value: m.results.notRegistered.reason,
          emphasis: true,
        },
        event,
      ];
    case "unknown_student":
    case "unknown_event":
      return [];
  }
}

function offlineNoteFor(result: ScanResult): string {
  if (result.outcome === "checked_in") return m.results.offline.saved;
  if (result.outcome === "unknown_student")
    return m.results.offline.listMayBeOld;
  return m.results.offline.checkedAgainstList;
}

export function describeResult(context: Context): ResultDescription {
  const { result, offline } = context;
  const base = BASE[result.outcome];
  return {
    ...base,
    name: result.student?.fullName ?? m.results.unknownName,
    idLine: m.results.studentLine(result.studentId),
    rows: [
      ...(result.student?.major
        ? [{ label: m.results.major, value: result.student.major }]
        : []),
      ...rowsFor(context),
    ],
    ...(offline ? { offlineNote: offlineNoteFor(result) } : {}),
  };
}
