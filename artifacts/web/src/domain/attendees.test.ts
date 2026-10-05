import { describe, expect, it } from "vitest";
import { attendeeRows } from "./attendees";
import { makeRoster } from "./testing";

const ids = (rows: ReturnType<typeof attendeeRows>) =>
  rows.map((r) => r.student.studentId);

describe("attendeeRows", () => {
  const roster = makeRoster();

  it("lists everyone registered for the event, checked in or not, by ID", () => {
    const rows = attendeeRows(roster, {
      eventId: "rehearsal",
      status: "all",
      query: "",
    });
    expect(ids(rows)).toEqual(["1001", "1002"]);
    expect(rows[0]).toMatchObject({
      checkedInByName: "Sara",
      registration: { checkedInAt: "2026-06-11T09:14:00.000Z" },
    });
    expect(rows[1]).toMatchObject({ checkedInByName: null });
  });

  it("filters by whether they checked in", () => {
    const options = { eventId: "graduation", query: "" } as const;
    expect(ids(attendeeRows(roster, { ...options, status: "in" }))).toEqual([
      "1003",
    ]);
    expect(ids(attendeeRows(roster, { ...options, status: "out" }))).toEqual([
      "1001",
      "1002",
    ]);
  });

  it("narrows by part of the ID or the name, together with the filter", () => {
    const options = { eventId: "graduation", status: "out" } as const;
    expect(ids(attendeeRows(roster, { ...options, query: "002" }))).toEqual([
      "1002",
    ]);
    expect(ids(attendeeRows(roster, { ...options, query: "layla" }))).toEqual([
      "1001",
    ]);
    expect(attendeeRows(roster, { ...options, query: "nobody" })).toEqual([]);
  });

  it("is empty for an event nobody is registered for", () => {
    expect(
      attendeeRows(roster, { eventId: "trophy", status: "all", query: "" }),
    ).toEqual([]);
  });
});
