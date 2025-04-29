import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { logErrorToSentry } from "@/utils/sentry";
import { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

/**
 * Creates a Persister using chrome.storage.local.
 * This allows React Query cache to be persisted in the extension's local storage.
 */
export const createChromeStoragePersister = (): Persister => {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await chrome.storage.local.set({
          [REACT_QUERY_KEYS.OFFLINE_CACHE]: JSON.stringify(client),
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
                message: "Error restoring React Query client from chrome.storage:",
                error: chrome.runtime.lastError,
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
