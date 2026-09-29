import type { Registration } from "@workspace/api-client-react";
import { getGetRosterQueryKey } from "@workspace/api-client-react";
import type { QueryClient } from "@tanstack/react-query";
import { replaceRegistrations, type Roster } from "@/domain/roster";

/**
 * Puts registrations the server just confirmed into the saved roster, so the
 * queue can let go of the scans they came from without any screen seeing them
 * in neither place.
 */
export async function foldIntoRoster(
  queryClient: QueryClient,
  registrations: readonly Registration[],
): Promise<void> {
  if (registrations.length === 0) return;
  const key = getGetRosterQueryKey();

  // A roster read that began before these answers came back would land after
  // them and put the old rows back: call it off first...
  const reading = queryClient.isFetching({ queryKey: key }) > 0;
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<Roster>(
    key,
    (roster) => roster && replaceRegistrations(roster, registrations),
  );
  // ...and start it again, so a first load that was called off is not left
  // waiting for the next poll.
  if (reading) void queryClient.invalidateQueries({ queryKey: key });
}
