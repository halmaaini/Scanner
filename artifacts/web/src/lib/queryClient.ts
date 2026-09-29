import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { getGetCurrentStaffQueryKey } from "@workspace/api-client-react";
import { CACHE_MAX_AGE_MS, CACHE_VERSION, STORAGE_KEYS } from "@/config";
import { isNetworkError, isUnauthorized } from "./errors";
import { reportReachable } from "./network";
import { appStorage } from "./storage";

const staffKey = getGetCurrentStaffQueryKey();

/** Any answer from the server proves it is reachable; only a network failure does not. */
function noteOutcome(error: unknown): void {
  reportReachable(!isNetworkError(error));
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onSuccess: () => reportReachable(true),
    onError: (error, query) => {
      noteOutcome(error);
      // Any signed-in request that comes back 401 means the session is gone:
      // ask "who am I" again so the app notices and shows the sign-in page.
      if (isUnauthorized(error) && query.queryKey[0] !== staffKey[0]) {
        void queryClient.invalidateQueries({ queryKey: staffKey });
      }
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: () => reportReachable(true),
    onError: noteOutcome,
  }),
  defaultOptions: {
    queries: {
      // Answer from the saved copy first and try the network in the background;
      // never wait for a connection that is not there.
      networkMode: "offlineFirst",
      retry: 1,
      staleTime: 10_000,
      // Must outlive the persisted copy (see CACHE_MAX_AGE_MS).
      gcTime: CACHE_MAX_AGE_MS,
    },
    // Writes fail fast when offline instead of hanging until a connection returns
    // (real writes go through the outbox anyway).
    mutations: { networkMode: "always" },
  },
});

export const persister = createSyncStoragePersister({
  storage: appStorage,
  key: STORAGE_KEYS.queryCache,
  throttleTime: 1_000,
});

/**
 * Only what a device needs to keep working offline is saved: who is signed in
 * and the roster (staff), and a student's own card (attendees). Sign-out wipes it.
 */
const PERSISTED_PREFIXES = ["/api/auth/me", "/api/roster", "/api/cards/"];

export const persistOptions: PersistQueryClientProviderProps["persistOptions"] =
  {
    persister,
    maxAge: CACHE_MAX_AGE_MS,
    buster: CACHE_VERSION,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        query.state.status === "success" &&
        PERSISTED_PREFIXES.some((prefix) =>
          String(query.queryKey[0]).startsWith(prefix),
        ),
    },
  };
