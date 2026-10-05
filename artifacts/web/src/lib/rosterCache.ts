import { getGetRosterQueryKey, type Roster } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";

/**
 * Applies a change the server has accepted to the roster on screen. A roster
 * read that began earlier would land after this and put the old state back,
 * so those are cancelled first; a fresh read then confirms.
 */
export async function patchRoster(update: (roster: Roster) => Roster) {
  await queryClient.cancelQueries({ queryKey: getGetRosterQueryKey() });
  queryClient.setQueryData<Roster>(
    getGetRosterQueryKey(),
    (roster) => roster && update(roster),
  );
  void queryClient.invalidateQueries({ queryKey: getGetRosterQueryKey() });
}
