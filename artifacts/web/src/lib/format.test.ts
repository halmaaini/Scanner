import { describe, expect, it } from "vitest";
import { formatDay, formatSpreadsheetTime } from "./format";

// The tests run in UTC (see vitest.config.ts), so local and UTC times agree.
describe("formatDay", () => {
  it("writes the calendar day with a two-digit month and day", () => {
    expect(formatDay(new Date("2026-06-05T09:00:00.000Z"))).toBe("2026-06-05");
  });

  it("uses this device's day, not UTC's", () => {
    // A local time just after midnight is still the same local day, whatever UTC says.
    expect(formatDay(new Date(2026, 5, 5, 0, 30))).toBe("2026-06-05");
    expect(formatDay(new Date(2026, 5, 5, 23, 30))).toBe("2026-06-05");
  });
});

describe("formatSpreadsheetTime", () => {
  it("writes a date and time a spreadsheet reads as one", () => {
    expect(formatSpreadsheetTime("2026-06-11T12:14:09.000Z")).toBe(
      "2026-06-11 12:14:09",
    );
  });
});
