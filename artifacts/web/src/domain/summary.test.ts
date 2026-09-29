import { describe, expect, it } from "vitest";
import { latestCheckIns, summarizeEvents, summaryFor } from "./summary";
import { makeRoster, reg } from "./testing";

describe("summarizeEvents", () => {
  it("counts expected and checked in per event, in event order", () => {
    const summaries = summarizeEvents(makeRoster());
    expect(summaries.map((s) => [s.event.id, s.expected, s.checkedIn])).toEqual(
      [
        ["rehearsal", 2, 1],
        // Karim (revoked, checked in) is in neither number.
        ["graduation", 2, 0],
      ],
    );
  });

  it("gives an event with nobody on its list zeros", () => {
    const roster = makeRoster({
      events: [
        ...makeRoster().events,
        { id: "trophy", name: "Trophy", sortOrder: 3, isOpen: false },
      ],
    });
    expect(summarizeEvents(roster).at(-1)).toMatchObject({
      expected: 0,
      checkedIn: 0,
    });
  });

  it("never reports more checked in than expected", () => {
    for (const s of summarizeEvents(makeRoster())) {
      expect(s.checkedIn).toBeLessThanOrEqual(s.expected);
    }
  });

  it("finds an event's summary by id", () => {
    const summaries = summarizeEvents(makeRoster());
    expect(summaryFor(summaries, "graduation")?.event.name).toBe("Graduation");
    expect(summaryFor(summaries, undefined)).toBeUndefined();
  });
});

describe("latestCheckIns", () => {
  it("lists check-ins newest first with student, event and who scanned", () => {
    const roster = makeRoster({
      registrations: [
        ...makeRoster().registrations,
        reg("1002", "rehearsal", "2026-06-11T10:00:00.000Z", 3),
      ].filter(
        (r) =>
          !(
            r.studentId === "1002" &&
            r.eventId === "rehearsal" &&
            !r.checkedInAt
          ),
      ),
    });
    expect(latestCheckIns(roster, 10)).toEqual([
      {
        studentId: "1003",
        fullName: "Karim Nasser",
        eventName: "Graduation",
        checkedInAt: "2026-06-12T09:00:00.000Z",
        checkedInByName: "Omar",
      },
      {
        studentId: "1002",
        fullName: "Yusuf Ibrahim",
        eventName: "Rehearsal",
        checkedInAt: "2026-06-11T10:00:00.000Z",
        checkedInByName: "Omar",
      },
      {
        studentId: "1001",
        fullName: "Layla Hassan",
        eventName: "Rehearsal",
        checkedInAt: "2026-06-11T09:14:00.000Z",
        checkedInByName: "Sara",
      },
    ]);
  });

  it("respects the limit and copes with an unknown staff id", () => {
    const roster = makeRoster({ staff: [] });
    const rows = latestCheckIns(roster, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.checkedInByName).toBeNull();
  });
});
