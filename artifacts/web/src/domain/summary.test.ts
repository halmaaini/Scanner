import { describe, expect, it } from "vitest";
import { summarizeEvents, summaryFor } from "./summary";
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
