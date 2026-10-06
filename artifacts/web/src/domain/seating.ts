import {
  HALL_ROWS,
  findSeat,
  seatLabel,
  seatsInRow,
  type HallSeat,
} from "@workspace/attendance";
import type { Registration, Roster, Student } from "./roster";

/** How a seat reads on the live plan. */
export type SeatMark = "present" | "expected" | "revoked";

export interface SeatedStudent {
  student: Student;
  registration: Registration;
  seat: HallSeat;
  mark: SeatMark;
}

/** The hall seat a student holds, or undefined: no seat given, or one the hall does not have. */
export function studentSeat(
  student: Pick<Student, "seatRow" | "seatNumber">,
): HallSeat | undefined {
  return student.seatRow && student.seatNumber
    ? findSeat(student.seatRow, student.seatNumber)
    : undefined;
}

export interface SeatingView {
  /** Seated students by seat (`seatLabel`, such as "F7"). */
  bySeat: ReadonlyMap<string, SeatedStudent>;
  /** On the event's list but with no seat yet. */
  noSeat: Student[];
  /** Given a seat the hall does not have (a typo in the data). */
  offPlan: Student[];
  present: number;
  expected: number;
}

/** The live seating of one event: a view of the roster, like every other report. */
export function seatingView(roster: Roster, eventId: string): SeatingView {
  const students = new Map(roster.students.map((s) => [s.studentId, s]));
  const bySeat = new Map<string, SeatedStudent>();
  const noSeat: Student[] = [];
  const offPlan: Student[] = [];
  let present = 0;
  let expected = 0;

  for (const registration of roster.registrations) {
    if (registration.eventId !== eventId) continue;
    const student = students.get(registration.studentId);
    if (!student) continue;

    if (!student.seatRow && !student.seatNumber) {
      noSeat.push(student);
      continue;
    }
    const seat = studentSeat(student);
    if (!seat) {
      offPlan.push(student);
      continue;
    }
    const mark: SeatMark = !student.isActive
      ? "revoked"
      : registration.checkedInAt
        ? "present"
        : "expected";
    if (mark === "present") present += 1;
    if (mark === "expected") expected += 1;
    bySeat.set(seatLabel(seat.row, seat.number), {
      student,
      registration,
      seat,
      mark,
    });
  }

  const byName = (a: Student, b: Student) =>
    a.fullName.localeCompare(b.fullName);
  return {
    bySeat,
    noSeat: noSeat.sort(byName),
    offPlan: offPlan.sort(byName),
    present,
    expected,
  };
}

export interface SeatDirections {
  /** Rows between this one and the front row (A); 0 is the front row. */
  rowsBack: number;
  side: "left" | "right";
  seatsInRow: number;
}

/** What to tell someone about where their seat is. */
export function seatDirections(seat: HallSeat): SeatDirections {
  return {
    rowsBack: HALL_ROWS.length - 1 - HALL_ROWS.indexOf(seat.row),
    side: seat.side,
    seatsInRow: seatsInRow(seat.row).length,
  };
}
