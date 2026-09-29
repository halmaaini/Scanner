import { useGetCurrentStaff, type Staff } from "@workspace/api-client-react";
import { STAFF_STALE_MS } from "@/config";
import { isUnauthorized } from "@/lib/errors";

export type StaffState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; staff: Staff };

/**
 * Who is signed in. The answer is saved on the device, so a scanner that is
 * opened with no connection still knows who it is; only the server saying
 * "401" signs someone out.
 */
export function useStaff(): StaffState {
  const query = useGetCurrentStaff({
    query: {
      retry: false,
      staleTime: STAFF_STALE_MS,
      refetchOnWindowFocus: true,
    },
  });

  // Checked first: after a 401 the query still holds the previous answer.
  if (isUnauthorized(query.error)) return { status: "signedOut" };
  if (query.data) return { status: "signedIn", staff: query.data.staff };
  if (query.isPending) return { status: "loading" };
  // Nobody is saved on this device and the server cannot be reached.
  return { status: "signedOut" };
}
