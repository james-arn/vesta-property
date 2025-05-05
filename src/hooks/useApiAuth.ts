import { StorageKeys } from "@/constants/storage";
import { useCallback, useState } from "react";

/**
 * Custom hook for authenticated API requests to Vesta services.
 *
 * This hook provides utilities for making authenticated API calls by automatically
 * retrieving and attaching the user's authentication token from Chrome storage.
 *
 * It handles:
 * - Loading states during API requests
 * - Error handling and state management
 * - Authentication token retrieval from Chrome storage
 * - Proper headers for authenticated requests
 *
 * @returns An object containing:
 * - fetchWithAuth: Function to make authenticated API requests
 * - isLoading: Boolean indicating if a request is in progress
 * - error: Error message if the request failed
 * - getAuthToken: Function to retrieve the authentication token
 */

export const useApiAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the authentication token from storage
  const getAuthToken = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      chrome.storage.local.get([StorageKeys.AUTH_ACCESS_TOKEN], (result) => {
        resolve(result[StorageKeys.AUTH_ACCESS_TOKEN] || "");
      });
    });
  }, []);

  // Fetch with authentication helper
  const fetchWithAuth = useCallback(
    async <T>(url: string, options: RequestInit = {}): Promise<T> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getAuthToken();

        if (!token) {
          throw new Error("No authentication token available");
        }

        const response = await fetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error((data as { message: string }).message || "An error occurred");
        }

        setIsLoading(false);
        return data as T;
      } catch (err) {
        setIsLoading(false);
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        throw err;
      }
    },
    [getAuthToken]
  );

  return { fetchWithAuth, isLoading, error };
};
