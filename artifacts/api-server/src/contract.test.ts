import {
  MAX_EVENT_ID_LENGTH,
  MAX_SCANS_PER_REQUEST,
  MAX_STUDENT_ID_LENGTH,
} from "@workspace/attendance";
import {
  GetCardParams,
  StaffRole,
  SubmitScansBody,
  UndoCheckInParams,
} from "@workspace/api-zod";
import { STAFF_ROLES } from "@workspace/db";
import { describe, expect, it } from "vitest";

// Guards the facts that live both in the shared library or the database (so
// scanners and Postgres can apply them) and in the OpenAPI spec (so the server
// can): they must agree.
describe("API contract matches the shared rules", () => {
  const atLimit = "1".repeat(MAX_STUDENT_ID_LENGTH);
  const overLimit = "1".repeat(MAX_STUDENT_ID_LENGTH + 1);
  const scan = (studentId: string, eventId = "graduation") => ({
    scans: [
      {
        id: crypto.randomUUID(),
        studentId,
        eventId,
        scannedAt: new Date().toISOString(),
      },
    ],
  });

  it("accepts a student ID of exactly the shared maximum length and no more", () => {
    expect(SubmitScansBody.safeParse(scan(atLimit)).success).toBe(true);
    expect(SubmitScansBody.safeParse(scan(overLimit)).success).toBe(false);
    expect(GetCardParams.safeParse({ studentId: atLimit }).success).toBe(true);
    expect(GetCardParams.safeParse({ studentId: overLimit }).success).toBe(
      false,
    );
    expect(
      UndoCheckInParams.safeParse({ eventId: "e", studentId: atLimit }).success,
    ).toBe(true);
    expect(
      UndoCheckInParams.safeParse({ eventId: "e", studentId: overLimit })
        .success,
    ).toBe(false);
  });

  it("accepts an event id of exactly the shared maximum length and no more", () => {
    const atLimit = "e".repeat(MAX_EVENT_ID_LENGTH);
    const overLimit = "e".repeat(MAX_EVENT_ID_LENGTH + 1);
    expect(SubmitScansBody.safeParse(scan("1001", atLimit)).success).toBe(true);
    expect(SubmitScansBody.safeParse(scan("1001", overLimit)).success).toBe(
      false,
    );
    expect(
      UndoCheckInParams.safeParse({ eventId: atLimit, studentId: "1001" })
        .success,
    ).toBe(true);
    expect(
      UndoCheckInParams.safeParse({ eventId: overLimit, studentId: "1001" })
        .success,
    ).toBe(false);
  });

  it("accepts exactly the shared maximum number of scans per request and no more", () => {
    const one = scan("1001").scans[0]!;
    const many = (n: number) => ({
      scans: Array.from({ length: n }, () => one),
    });
    expect(SubmitScansBody.safeParse(many(MAX_SCANS_PER_REQUEST)).success).toBe(
      true,
    );
    expect(
      SubmitScansBody.safeParse(many(MAX_SCANS_PER_REQUEST + 1)).success,
    ).toBe(false);
    expect(SubmitScansBody.safeParse(many(0)).success).toBe(false);
  });

  // The spec's roles feed the API and `lib/attendance`; the database check
  // constraint has its own copy (`STAFF_ROLES`), since SQL cannot import a spec.
  it("knows the same staff roles as the database", () => {
    expect([...STAFF_ROLES].sort()).toEqual(Object.values(StaffRole).sort());
  });
});
