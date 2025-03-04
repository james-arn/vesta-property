import { AUTH_CONFIG } from "@/constants/authConfig";
import { StorageKeys } from "@/constants/storage";
import { TokenResponse } from "@/types/auth";
import { logErrorToSentry } from "@/utils/sentry";

/**
 * Exchanges an authorization code for access, ID, and refresh tokens
 * Uses PKCE flow for security in public clients
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const tokenEndpoint = `${AUTH_CONFIG.AUTH_COGNITO_DOMAIN}/oauth2/token`;

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("client_id", AUTH_CONFIG.AUTH_CLIENT_ID);
  params.append("redirect_uri", AUTH_CONFIG.REDIRECT_URI);
  params.append("code", code);
  params.append("code_verifier", codeVerifier);

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error_description || errorData.error || "Failed to exchange code for tokens"
    );
  }

  return await response.json();
}

/**
 * Uses a refresh token to obtain new ID and access tokens
 * Should be called before tokens expire (default: 1 hour for ID/access tokens)
 */
export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const tokenEndpoint = `${AUTH_CONFIG.AUTH_COGNITO_DOMAIN}/oauth2/token`;

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("client_id", AUTH_CONFIG.AUTH_CLIENT_ID);
  params.append("refresh_token", refreshToken);

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_description || errorData.error || "Failed to refresh tokens");
    }

    return await response.json();
  } catch (error) {
    logErrorToSentry(error, "error");
    throw error;
  }
}

/**
 * Stores authentication tokens securely in Chrome storage
 * Uses an immutable pattern to avoid partial updates
 */
export async function storeAuthTokens(tokenResponse: TokenResponse): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create an immutable token object with only the needed fields
    const tokensToStore = {
      [StorageKeys.AUTH_ID_TOKEN]: tokenResponse.id_token,
      [StorageKeys.AUTH_ACCESS_TOKEN]: tokenResponse.access_token,
      ...(tokenResponse.refresh_token
        ? {
            [StorageKeys.AUTH_REFRESH_TOKEN]: tokenResponse.refresh_token,
          }
        : {}),
      [StorageKeys.AUTH_SUCCESS]: true,
      [StorageKeys.AUTH_IN_PROGRESS]: false,
    };

    chrome.storage.local.set(tokensToStore, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
