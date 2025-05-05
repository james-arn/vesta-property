import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { logErrorToSentry } from "@/utils/sentry";
import { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

/**
 * Creates a Persister using chrome.storage.local, filtering out specific large query keys.
 * This allows most of the React Query cache to be persisted while keeping large datasets in memory only.
 */
export const createChromeStoragePersister = (): Persister => {
  return {
    persistClient: async (client: PersistedClient) => {
      // exclude heavy premium search so local storage is not overloaded
      try {
        const filteredClientState = {
          ...client.clientState,
          queries: client.clientState.queries.filter((query) => {
            if (Array.isArray(query.queryKey) && query.queryKey.length > 0) {
              return query.queryKey[0] !== REACT_QUERY_KEYS.PREMIUM_STREET_DATA;
            }
            return true;
          }),
        };

        // Create the client object to persist with the filtered state
        const clientToPersist: PersistedClient = {
          timestamp: client.timestamp,
          buster: client.buster,
          clientState: filteredClientState,
        };

        await chrome.storage.local.set({
          [REACT_QUERY_KEYS.OFFLINE_CACHE]: JSON.stringify(clientToPersist),
        });
      } catch (error) {
        logErrorToSentry({
          message: "Error persisting React Query client to chrome.storage:",
          error,
        });
      }
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      return new Promise((resolve) => {
        chrome.storage.local.get(REACT_QUERY_KEYS.OFFLINE_CACHE, (result) => {
          if (chrome.runtime.lastError) {
            logErrorToSentry({
              message: "Error restoring React Query client from chrome.storage:",
              error: chrome.runtime.lastError,
            });
            resolve(undefined);
            return;
          }
          if (result[REACT_QUERY_KEYS.OFFLINE_CACHE]) {
            try {
              resolve(JSON.parse(result[REACT_QUERY_KEYS.OFFLINE_CACHE]) as PersistedClient);
            } catch (error) {
              logErrorToSentry({
                message: "Error parsing stored React Query client from chrome.storage:",
                error: error, // Log the actual parsing error
              });
              resolve(undefined);
            }
          } else {
            resolve(undefined);
          }
        });
      });
    },
    removeClient: async () => {
      return new Promise((resolve) => {
        chrome.storage.local.remove(REACT_QUERY_KEYS.OFFLINE_CACHE, () => {
          if (chrome.runtime.lastError) {
            logErrorToSentry({
              message: "Error removing React Query client from chrome.storage:",
              error: chrome.runtime.lastError,
            });
          }
          resolve();
        });
      });
    },
  };
};
