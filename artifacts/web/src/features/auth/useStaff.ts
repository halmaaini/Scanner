import { useGetCurrentStaff, type Staff } from "@workspace/api-client-react";
import { isUnauthorized } from "@/lib/errors";

export type StaffState =
  | { status: "loading" }
  /** `unreachable`: nobody is saved on this device and the server cannot be reached. */
  | { status: "signedOut"; unreachable: boolean }
  | { status: "signedIn"; staff: Staff };

/**
 * Who is signed in. The answer is saved on the device, so a scanner that is
 * opened with no connection still knows who it is; only the server saying
 * "401" signs someone out.
 */
export function useStaff(): StaffState {
  const query = useGetCurrentStaff({
    query: { retry: false, staleTime: 60_000, refetchOnWindowFocus: true },
  });

  // Checked first: after a 401 the query still holds the previous answer.
  if (isUnauthorized(query.error))
    return { status: "signedOut", unreachable: false };
  if (query.data) return { status: "signedIn", staff: query.data.staff };
  if (query.isPending) return { status: "loading" };
  return { status: "signedOut", unreachable: true };
}
