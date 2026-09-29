import {
  MAX_SCANS_PER_REQUEST,
  MAX_STUDENT_ID_LENGTH,
} from "@workspace/attendance";
import {
  GetCardParams,
  SubmitScansBody,
  UndoCheckInParams,
} from "@workspace/api-zod";
import { describe, expect, it } from "vitest";

// Guards the numbers that live both in the shared library (so scanners can
// apply them offline) and in the OpenAPI spec (so the server can): they must agree.
describe("API contract matches the shared rules", () => {
  const atLimit = "1".repeat(MAX_STUDENT_ID_LENGTH);
  const overLimit = "1".repeat(MAX_STUDENT_ID_LENGTH + 1);
  const scan = (studentId: string) => ({
    scans: [
      {
        id: crypto.randomUUID(),
        studentId,
        eventId: "graduation",
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
});
