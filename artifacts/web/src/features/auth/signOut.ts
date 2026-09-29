import { logout } from "@workspace/api-client-react";
import { forgetSavedCopy } from "@/lib/queryClient";
import { m } from "@/messages";
import { outbox } from "@/offline";

export type SignOutResult = "done" | "cancelled" | "failed";

/**
 * Ends the session and wipes what this device saved (the student list and
 * this person's unsent changes and unread problems), so the next person to
 * pick up the phone starts clean. Changes waiting from a different admin are
 * left alone: they are theirs to send when they sign in.
 *
 * It needs the server: signing out offline would leave the session alive on
 * the server while looking signed out here, which is worse than saying no.
 */
export async function signOut(staffId: number): Promise<SignOutResult> {
  const { ops, issues } = outbox.getState();
  const mine = ops.filter((op) => op.staffId === staffId).map((op) => op.id);
  const problems = issues.filter((issue) => issue.op.staffId === staffId);
  if (
    (mine.length > 0 || problems.length > 0) &&
    !window.confirm(m.auth.confirmDiscard(mine.length, problems.length))
  ) {
    return "cancelled";
  }

  try {
    await logout();
  } catch {
    return "failed";
  }

  outbox.settle(mine);
  outbox.dismissIssues(staffId);
  forgetSavedCopy();
  return "done";
}
