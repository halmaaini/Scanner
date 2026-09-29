import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins names and skips anything falsy", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("lets a later utility replace an earlier one that sets the same property", () => {
    expect(cn("gap-5 px-5", "gap-3")).toBe("px-5 gap-3");
    expect(cn("gap-5", "gap-[18px]")).toBe("gap-[18px]");
  });

  it("keeps the app's own colour and size utilities apart", () => {
    // A text colour token and a text size are different properties.
    expect(cn("text-muted", "text-[15px]")).toBe("text-muted text-[15px]");
    expect(cn("text-muted", "text-ink")).toBe("text-ink");
  });
});
