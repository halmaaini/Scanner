import { describe, expect, it } from "vitest";
import { cardPath, studentIdFromParam } from "./cardPath";

/** What the router hands the page for an address (it decodes the path once, as `decodeURI`). */
const paramFor = (studentId: string) =>
  decodeURI(cardPath(studentId).slice("/card/".length));

describe("card addresses", () => {
  it("leave ordinary IDs readable", () => {
    expect(cardPath("1001")).toBe("/card/1001");
    expect(cardPath("2021-04517")).toBe("/card/2021-04517");
  });

  it("bring every kind of ID back exactly, through the router's decoding", () => {
    const ids = [
      "1001",
      "AB/12",
      "CS/2021/045",
      "100%",
      "A%41",
      "50%25",
      "a b",
      "x?y#z",
      "a+b&c=d;e",
      "éè",
      String.fromCodePoint(0x0661, 0x0662, 0x0663),
    ];
    for (const id of ids) {
      expect(studentIdFromParam(paramFor(id)), id).toBe(id);
    }
  });

  it("also reads a link that was encoded only once", () => {
    expect(studentIdFromParam("AB%2F12")).toBe("AB/12");
  });

  it("takes an ID that is not valid encoding as it is", () => {
    expect(studentIdFromParam("100%")).toBe("100%");
  });
});
