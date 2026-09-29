import { describe, expect, it } from "vitest";
import { normalizeStudentId } from "./studentId";

describe("normalizeStudentId", () => {
  it("leaves a clean ID untouched, including letters, case and hyphens", () => {
    expect(normalizeStudentId("2021-04517")).toBe("2021-04517");
    expect(normalizeStudentId("Ab12-x")).toBe("Ab12-x");
  });

  it("removes surrounding and inner whitespace", () => {
    expect(normalizeStudentId("  2021 04517\n")).toBe("202104517");
    expect(normalizeStudentId("2021\u00a004517")).toBe("202104517");
  });

  it("converts Arabic-Indic digits", () => {
    expect(normalizeStudentId("٢٠٢١٠٤٥١٧")).toBe("202104517");
  });

  it("converts Persian digits", () => {
    expect(normalizeStudentId("۲۰۲۱۰۴۵۱۷")).toBe("202104517");
  });

  it("folds full-width characters", () => {
    expect(normalizeStudentId("２０２１")).toBe("2021");
  });

  it("drops invisible direction and zero-width marks", () => {
    expect(normalizeStudentId("\u200f2021\u200e04517\u200b")).toBe("202104517");
    expect(normalizeStudentId("\ufeff2021")).toBe("2021");
  });

  it("is idempotent", () => {
    const once = normalizeStudentId(" ٢٠٢١ 045\u200f17 ");
    expect(normalizeStudentId(once)).toBe(once);
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeStudentId("   \t")).toBe("");
  });
});
