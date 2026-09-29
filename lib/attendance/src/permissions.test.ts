import { describe, expect, it } from "vitest";
import { can, canUndoCheckIn } from "./permissions";

describe("can", () => {
  it("gives the super admin the report and undo-any", () => {
    expect(can("super", "view_report")).toBe(true);
    expect(can("super", "undo_any_check_in")).toBe(true);
  });

  it("keeps both away from plain admins", () => {
    expect(can("admin", "view_report")).toBe(false);
    expect(can("admin", "undo_any_check_in")).toBe(false);
  });
});

describe("canUndoCheckIn", () => {
  const admin = { id: 2, role: "admin" } as const;
  const superAdmin = { id: 1, role: "super" } as const;

  it("lets an admin undo their own check-in only", () => {
    expect(canUndoCheckIn(admin, { checkedInBy: 2 })).toBe(true);
    expect(canUndoCheckIn(admin, { checkedInBy: 3 })).toBe(false);
    expect(canUndoCheckIn(admin, { checkedInBy: null })).toBe(false);
  });

  it("lets the super admin undo anyone's", () => {
    expect(canUndoCheckIn(superAdmin, { checkedInBy: 3 })).toBe(true);
    expect(canUndoCheckIn(superAdmin, { checkedInBy: null })).toBe(true);
  });
});
