import { describe, expect, it } from "vitest";
import { resolveSelectedEvent } from "./selectedEvent";

const event = (id: string) => ({
  id,
  name: id,
  sortOrder: 0,
  isOpen: true,
});
const rehearsal = event("rehearsal");
const graduation = event("graduation");

describe("resolveSelectedEvent", () => {
  it("keeps the remembered event while it is open", () => {
    expect(resolveSelectedEvent([rehearsal, graduation], "graduation")).toEqual(
      { eventId: "graduation", replaced: null },
    );
  });

  it("uses the first open event when nothing was remembered", () => {
    expect(resolveSelectedEvent([rehearsal, graduation], null)).toEqual({
      eventId: "rehearsal",
      replaced: null,
    });
  });

  it("falls back to the first open event and says which one it passed over", () => {
    expect(resolveSelectedEvent([rehearsal], "graduation")).toEqual({
      eventId: "rehearsal",
      replaced: "graduation",
    });
  });

  it("has no event, and nothing to report, while none is open", () => {
    expect(resolveSelectedEvent([], "graduation")).toEqual({
      eventId: undefined,
      replaced: null,
    });
    expect(resolveSelectedEvent([], null)).toEqual({
      eventId: undefined,
      replaced: null,
    });
  });
});
