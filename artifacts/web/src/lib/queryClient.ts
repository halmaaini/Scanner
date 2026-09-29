import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import {
  getGetCardQueryKey,
  getGetCurrentStaffQueryKey,
  getGetRosterQueryKey,
} from "@workspace/api-client-react";
import {
  CACHE_MAX_AGE_MS,
  CACHE_VERSION,
  PERSIST_THROTTLE_MS,
  QUERY_RETRIES,
  QUERY_STALE_MS,
  STORAGE_KEYS,
} from "@/config";
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
      retry: QUERY_RETRIES,
      staleTime: QUERY_STALE_MS,
      // Must outlive the persisted copy (see CACHE_MAX_AGE_MS).
      gcTime: CACHE_MAX_AGE_MS,
    },
    // Writes fail fast when offline instead of hanging until a connection returns
    // (real writes go through the outbox anyway).
    mutations: { networkMode: "always" },
  },
});

/** The (synchronous) app storage in the shape the persister expects. */
const asyncStorage = {
  getItem: async (key: string) => appStorage.getItem(key),
  setItem: async (key: string, value: string) => appStorage.setItem(key, value),
  removeItem: async (key: string) => appStorage.removeItem(key),
};

export const persister = createAsyncStoragePersister({
  storage: asyncStorage,
  key: STORAGE_KEYS.queryCache,
  throttleTime: PERSIST_THROTTLE_MS,
});

/**
 * Forgets everything saved from the server: who is signed in, the student
 * list and cards. Unsent changes are not part of it (they live in the outbox).
 */
export function forgetSavedCopy(): void {
  queryClient.clear();
  void persister.removeClient();
}

/**
 * Only what a device needs to keep working offline is saved: who is signed in
 * and the roster (staff), and a student's own card (attendees). A query's key
 * is its URL, taken from the generated client so a renamed endpoint cannot
 * silently stop being saved; a card's key ends in the ID, hence "prefix".
 */
const PERSISTED_PREFIXES: readonly string[] = [
  getGetCurrentStaffQueryKey()[0],
  getGetRosterQueryKey()[0],
  getGetCardQueryKey("")[0],
];

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
