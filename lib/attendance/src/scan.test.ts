import { describe, expect, it } from "vitest";
import { evaluateScan, type ScanFacts } from "./scan";

const event = { id: "graduation" };
const active = { isActive: true };
const revoked = { isActive: false };
const open = { checkedInAt: null };
const done = { checkedInAt: "2026-06-12T10:42:00.000Z" };

const judge = (facts: Partial<ScanFacts>) =>
  evaluateScan({ event, student: active, registration: open, ...facts });

describe("evaluateScan", () => {
  it("checks in an active, registered student who has not checked in", () => {
    expect(judge({})).toBe("checked_in");
  });

  it("reports a repeat scan", () => {
    expect(judge({ registration: done })).toBe("already_checked_in");
    expect(judge({ registration: { checkedInAt: new Date() } })).toBe(
      "already_checked_in",
    );
  });

  it("rejects an unknown event before anything else", () => {
    expect(judge({ event: null, student: null })).toBe("unknown_event");
    expect(judge({ event: undefined })).toBe("unknown_event");
  });

  it("rejects an unknown student", () => {
    expect(judge({ student: null, registration: null })).toBe(
      "unknown_student",
    );
  });

  it("rejects a revoked student even if they already checked in", () => {
    expect(judge({ student: revoked })).toBe("revoked");
    expect(judge({ student: revoked, registration: done })).toBe("revoked");
    expect(judge({ student: revoked, registration: null })).toBe("revoked");
  });

  it("rejects a student who is not on the event's list", () => {
    expect(judge({ registration: null })).toBe("not_registered");
    expect(judge({ registration: undefined })).toBe("not_registered");
  });
});
