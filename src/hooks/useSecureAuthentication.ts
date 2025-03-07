import { ActionEvents } from "@/constants/actionEvents";
import { ENV_CONFIG } from "@/constants/environmentConfig";
import { StorageKeys } from "@/constants/storage";
import { toast } from "@/hooks/use-toast";
import { logErrorToSentry } from "@/utils/sentry";
import { useCallback, useEffect, useState } from "react";

/**
 * Custom hook to securely manage authentication state for Chrome extensions
 *
 * This hook:
 * 1. Uses chrome.storage.local to store and retrieve tokens
 * 2. Verifies token validity on each authentication check
 * 3. Provides loading state and user information
 * 4. Handles sign in/sign out with proper token management
 * 5. Manages the PKCE authentication flow with OAuth 2.0 and PKCE
 * 6. Automatically refreshes tokens before they expire
 */
export const useSecureAuthentication = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);

  // Helper function to validate and parse JWT token
  const validateAndParseJwtToken = useCallback((token: string) => {
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      throw new Error("Invalid token format");
    }

    // Only decode the payload (middle part)
    return JSON.parse(atob(tokenParts[1].replace(/-/g, "+").replace(/_/g, "/")));
  }, []);

  // Function to securely sign out - defined early to avoid circular dependencies
  const signOut = useCallback(() => {
    // First, remove all auth tokens from storage
    chrome.storage.local.remove(
      [
        StorageKeys.AUTH_ID_TOKEN,
        StorageKeys.AUTH_ACCESS_TOKEN,
        StorageKeys.AUTH_REFRESH_TOKEN,
        StorageKeys.AUTH_CODE_VERIFIER,
      ],
      () => {
        setIsAuthenticated(false);
        setUserEmail(null);

        toast({
          description: "You have been signed out successfully.",
          variant: "default",
          duration: 3000,
        });

        // Construct logout URL to properly terminate the Cognito session
        // Per AWS docs: https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
        let logoutUrl: URL;
        if (ENV_CONFIG.AUTH_COGNITO_DOMAIN.includes("cognito-idp")) {
          // If using the API endpoint format (for production)
          logoutUrl = new URL(
            `${ENV_CONFIG.AUTH_COGNITO_DOMAIN}/${ENV_CONFIG.AUTH_USER_POOL_ID}/oauth2/logout`
          );
        } else {
          // If using the domain format (for development)
          logoutUrl = new URL(`${ENV_CONFIG.AUTH_COGNITO_DOMAIN}/logout`);
        }

        logoutUrl.searchParams.append("client_id", ENV_CONFIG.AUTH_CLIENT_ID);
        logoutUrl.searchParams.append("logout_uri", ENV_CONFIG.LOGOUT_URI);

        // Open a tab to complete the Cognito logout process
        chrome.tabs.create({ url: logoutUrl.toString() }, (tab) => {
          console.log("logoutUrl", logoutUrl.toString());
          // Set a safety timeout in case logout takes too long or gets stuck
          chrome.storage.local.set({
            [StorageKeys.AUTH_LOGOUT_TAB_ID]: tab.id,
            [StorageKeys.AUTH_LOGOUT_START_TIME]: Date.now(),
          });
        });
      }
    );
  }, []);

  // Function to refresh tokens if they're about to expire - depends on signOut
  const refreshTokenIfNeeded = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous refresh attempts
    if (isRefreshingToken) {
      return false;
    }

    setIsRefreshingToken(true);

    try {
      // Get the current tokens
      const tokens = await new Promise<Record<string, any>>((resolve) => {
        chrome.storage.local.get(
          [
            StorageKeys.AUTH_ID_TOKEN,
            StorageKeys.AUTH_ACCESS_TOKEN,
            StorageKeys.AUTH_REFRESH_TOKEN,
          ],
          (result) => resolve(result)
        );
      });

      if (!tokens[StorageKeys.AUTH_ID_TOKEN] || !tokens[StorageKeys.AUTH_REFRESH_TOKEN]) {
        setIsRefreshingToken(false);
        return false;
      }

      // Parse token to check expiration
      const payload = validateAndParseJwtToken(tokens[StorageKeys.AUTH_ID_TOKEN]);
      const now = Math.floor(Date.now() / 1000);

      // If token is still valid for more than 5 minutes, no need to refresh
      if (payload.exp && payload.exp - now >= 300) {
        setIsRefreshingToken(false);
        return true;
      }

      // Send message to background script to refresh tokens
      const response = await chrome.runtime.sendMessage({
        action: ActionEvents.REFRESH_TOKENS,
        refreshToken: tokens[StorageKeys.AUTH_REFRESH_TOKEN],
      });

      setIsRefreshingToken(false);

      if (response && response.success) {
        // We'll call checkAuthentication separately
        return true;
      }

      // If token is expired and refresh failed, sign out
      if (payload.exp <= now) {
        signOut();
      }

      return false;
    } catch (error) {
      logErrorToSentry(error, "error");
      setIsRefreshingToken(false);
      return false;
    }
  }, [isRefreshingToken, validateAndParseJwtToken, signOut]);

  // Function to verify token validity - depends on refreshTokenIfNeeded
  const checkAuthentication = useCallback(() => {
    // Set a timeout to make sure we don't show the spinner forever
    let timeoutId = setTimeout(() => {
      setIsCheckingAuth(false);
    }, 2000); // Max 2 seconds for auth check

    setIsCheckingAuth(true);

    // Get all tokens in a single storage call for efficiency
    chrome.storage.local.get(
      [StorageKeys.AUTH_ID_TOKEN, StorageKeys.AUTH_ACCESS_TOKEN, StorageKeys.AUTH_REFRESH_TOKEN],
      (result) => {
        clearTimeout(timeoutId);

        if (result[StorageKeys.AUTH_ID_TOKEN] && result[StorageKeys.AUTH_ACCESS_TOKEN]) {
          try {
            // Parse and validate the token
            const payload = validateAndParseJwtToken(result[StorageKeys.AUTH_ID_TOKEN]);
            const now = Math.floor(Date.now() / 1000);

            if (payload.exp && payload.exp > now) {
              // Token is valid and not expired
              setIsAuthenticated(true);
              setUserEmail(payload.email || null);

              // Proactively refresh token if it's about to expire
              if (payload.exp - now < 300) {
                // Less than 5 minutes remaining
                refreshTokenIfNeeded();
              }
            } else {
              // Token is expired, try to refresh if we have a refresh token
              if (result[StorageKeys.AUTH_REFRESH_TOKEN]) {
                refreshTokenIfNeeded();
              } else {
                // No refresh token available, clean up
                chrome.storage.local.remove([
                  StorageKeys.AUTH_ID_TOKEN,
                  StorageKeys.AUTH_ACCESS_TOKEN,
                  StorageKeys.AUTH_REFRESH_TOKEN,
                ]);
                setIsAuthenticated(false);
                setUserEmail(null);
              }
            }
          } catch (error) {
            logErrorToSentry(error, "error");
            setIsAuthenticated(false);
            setUserEmail(null);
          }
        } else {
          setIsAuthenticated(false);
          setUserEmail(null);
        }
        setIsCheckingAuth(false);
      }
    );
  }, [validateAndParseJwtToken, refreshTokenIfNeeded]);

  // Function to handle storage changes and keep auth state in sync
  const handleStorageChanges = useCallback(
    (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[StorageKeys.AUTH_ID_TOKEN] || changes[StorageKeys.AUTH_ACCESS_TOKEN]) {
        checkAuthentication();
      }
    },
    [checkAuthentication]
  );

  // Check authentication on mount and set up a listener for storage changes
  useEffect(() => {
    // Initial check
    checkAuthentication();

    // Listen for storage changes
    chrome.storage.onChanged.addListener(handleStorageChanges);

    // Set up a timer to refresh tokens every 30 minutes
    const tokenRefreshInterval = setInterval(
      () => {
        if (isAuthenticated) {
          refreshTokenIfNeeded();
        }
      },
      30 * 60 * 1000
    ); // 30 minutes

    // Clean up listeners on unmount
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChanges);
      clearInterval(tokenRefreshInterval);
    };
  }, [checkAuthentication, handleStorageChanges, isAuthenticated, refreshTokenIfNeeded]);

  // Helper functions for PKCE authentication flow
  const generateCodeVerifier = useCallback(() => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, (dec) => ("0" + dec.toString(16)).substr(-2)).join("");
  }, []);

  const base64URLEncode = useCallback((str: string) => {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }, []);

  const generateCodeChallenge = useCallback(
    async (codeVerifier: string) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      const base64Digest = base64URLEncode(String.fromCharCode(...new Uint8Array(digest)));
      return base64Digest;
    },
    [base64URLEncode]
  );

  // Handle checking authentication status periodically during sign-in flow
  const monitorAuthenticationStatus = useCallback(
    (checkAuthStatus: NodeJS.Timeout) => {
      chrome.storage.local.get(
        [StorageKeys.AUTH_SUCCESS, StorageKeys.AUTH_ERROR, StorageKeys.AUTH_IN_PROGRESS],
        (result) => {
          if (!result[StorageKeys.AUTH_IN_PROGRESS]) {
            clearInterval(checkAuthStatus);
            setIsSigningIn(false);

            if (result[StorageKeys.AUTH_ERROR]) {
              toast({
                description: result[StorageKeys.AUTH_ERROR],
                variant: "destructive",
              });
              // Clear the error
              chrome.storage.local.remove([StorageKeys.AUTH_ERROR]);
            } else if (result[StorageKeys.AUTH_SUCCESS]) {
              // Success! Refresh the UI
              checkAuthentication();
            }
          }
        }
      );
    },
    [checkAuthentication]
  );

  // Function to initiate the sign-in process with PKCE
  const signInRedirect = useCallback(() => {
    // Show loading state
    setIsSigningIn(true);

    try {
      const state = Math.random().toString(36).substring(2, 15);
      const codeVerifier = generateCodeVerifier();

      // Store code verifier in chrome.storage.local for persistence
      chrome.storage.local.set(
        {
          [StorageKeys.AUTH_CODE_VERIFIER]: codeVerifier,
          [StorageKeys.AUTH_IN_PROGRESS]: true,
          [StorageKeys.AUTH_START_TIME]: Date.now(),
        },
        () => {
          generateCodeChallenge(codeVerifier)
            .then((codeChallenge) => {
              // Construct the authorization URL for hosted UI
              const authUrl = new URL(ENV_CONFIG.AUTH_COGNITO_DOMAIN);
              authUrl.pathname = "/oauth2/authorize";
              authUrl.searchParams.append("client_id", ENV_CONFIG.AUTH_CLIENT_ID);
              authUrl.searchParams.append("response_type", "code");
              authUrl.searchParams.append("scope", "phone openid email");
              authUrl.searchParams.append("redirect_uri", ENV_CONFIG.REDIRECT_URI);
              authUrl.searchParams.append("state", state);
              authUrl.searchParams.append("code_challenge", codeChallenge);
              authUrl.searchParams.append("code_challenge_method", "S256");

              // Show a toast notifying the user about the redirect
              toast({
                description: "Opening sign-in page in a new tab. Please complete sign-in there.",
                variant: "default",
                duration: 5000,
              });

              // Open auth tab and let Chrome handle the rest
              chrome.tabs.create({ url: authUrl.toString() });

              // Add a listener to check for authentication status changes
              const checkAuthStatus = setInterval(() => {
                monitorAuthenticationStatus(checkAuthStatus);
              }, 1000);

              // Set a timeout to prevent waiting forever
              setTimeout(() => {
                chrome.storage.local.get([StorageKeys.AUTH_IN_PROGRESS], (result) => {
                  if (result[StorageKeys.AUTH_IN_PROGRESS]) {
                    chrome.storage.local.set({
                      [StorageKeys.AUTH_IN_PROGRESS]: false,
                      [StorageKeys.AUTH_ERROR]: "Authentication timed out. Please try again.",
                    });
                  }
                });
              }, 180000); // 3 minutes timeout
            })
            .catch((error) => {
              logErrorToSentry(error, "error");
              setIsSigningIn(false);
              toast({
                description: "Authentication preparation failed.",
                variant: "destructive",
              });
            });
        }
      );
    } catch (error) {
      logErrorToSentry(error, "error");
      setIsSigningIn(false);
      toast({
        description: "Authentication failed. Please try again.",
        variant: "destructive",
      });
    }
  }, [generateCodeVerifier, generateCodeChallenge, monitorAuthenticationStatus]);

  return {
    isAuthenticated,
    isCheckingAuth,
    isSigningIn,
    isRefreshingToken,
    userEmail,
    checkAuthentication,
    signInRedirect,
    signOut,
    refreshTokenIfNeeded,
  };
};

export default useSecureAuthentication;
