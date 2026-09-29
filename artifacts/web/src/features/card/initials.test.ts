import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("uses the first letters of the first two words", () => {
    expect(initialsOf("Layla Hassan")).toBe("LH");
    expect(initialsOf("layla hassan al-amin")).toBe("LH");
  });

  it("copes with one word, extra spaces and blank names", () => {
    expect(initialsOf("Layla")).toBe("L");
    expect(initialsOf("  Layla   Hassan ")).toBe("LH");
    expect(initialsOf("   ")).toBe("");
  });

  it("works for Arabic names and letters outside the basic plane", () => {
    expect(initialsOf("ليلى حسن")).toBe("لح");
    expect(initialsOf("𝒜da Lovelace")).toBe("𝒜L");
  });
});
