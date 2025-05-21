import { ENV_CONFIG } from "@/constants/environmentConfig";
import { QUERY_PARAM_KEYS } from "@/constants/queryParamKeys";
import { StorageKeys } from "../../constants/storage";
import { logErrorToSentry } from "../sentry";
import {
  DEFAULT_ENGAGEMENT_TIME_IN_MSEC,
  SESSION_EXPIRATION_IN_MIN,
} from "./googleAnalyticsConsts";

/**
 * Retrieves or creates a unique client ID using chrome.storage.local.
 */
export async function getOrCreateClientId(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("clientId", (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      let clientId = result.clientId;
      if (!clientId) {
        clientId = crypto.randomUUID();
        chrome.storage.local.set({ clientId }, () => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve(clientId);
        });
      } else {
        resolve(clientId);
      }
    });
  });
}

/**
 * Retrieves or creates a session ID stored in chrome.storage.session.
 * A session expires after 30 minutes of inactivity.
 */
export async function getOrCreateSessionId(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.session.get("sessionData", (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      let sessionData = result.sessionData;
      const currentTime = Date.now();
      if (sessionData && sessionData.timestamp) {
        const durationInMin = (currentTime - parseInt(sessionData.timestamp)) / 60000;
        if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
          sessionData = null;
        } else {
          sessionData.timestamp = currentTime.toString();
          chrome.storage.session.set({ sessionData });
        }
      }
      if (!sessionData) {
        sessionData = {
          session_id: currentTime.toString(),
          timestamp: currentTime.toString(),
        };
        chrome.storage.session.set({ sessionData });
      }
      resolve(sessionData.session_id);
    });
  });
}

/**
 * Sends an event to GA4 using the Measurement Protocol.
 *
 * @param eventName - The name of the event
 * @param params - Additional parameters to send with the event
 */
export async function sendGA4Event(eventName: string, params: Record<string, any>): Promise<void> {
  try {
    const clientId = await getOrCreateClientId();
    if (!params.session_id) {
      params.session_id = await getOrCreateSessionId();
    }
    if (!params.engagement_time_msec) {
      params.engagement_time_msec = DEFAULT_ENGAGEMENT_TIME_IN_MSEC;
    }

    const payload = {
      client_id: clientId,
      events: [
        {
          name: eventName,
          params: {
            ...params,
            data_source: "chrome_extension",
            session_id: params.session_id,
            engagement_time_msec: params.engagement_time_msec,
            debug_mode: ENV_CONFIG.GA_DEBUG_MODE,
          },
        },
      ],
    };

    await fetch(
      `${process.env.GA_ENDPOINT}?measurement_id=${process.env.MEASUREMENT_ID}&api_secret=${process.env.API_SECRET}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  } catch (error) {
    console.error("Error sending analytics event:", error);
  }
}

/**
 * Checks if a property has been analysed in the current session to prevent duplicate GA events.
 * Uses chrome.storage.session.
 * @param propertyId The ID of the property to check.
 * @returns Promise<boolean> True if the property is new for this session, false otherwise.
 */
export async function isNewPropertyAnalysisThisSession(propertyId: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.session.get(
      [StorageKeys.VESTA_GA_ANALYSED_PROPERTY_IDS_SESSION],
      async (result) => {
        if (chrome.runtime.lastError) {
          logErrorToSentry(
            `Error getting ${StorageKeys.VESTA_GA_ANALYSED_PROPERTY_IDS_SESSION} from chrome.storage.session:`,
            "error"
          );
          resolve(true);
          return;
        }

        const analysedPropertyIds: string[] =
          result[StorageKeys.VESTA_GA_ANALYSED_PROPERTY_IDS_SESSION] || [];

        if (analysedPropertyIds.includes(propertyId)) {
          console.log(`Property already analyzed in this session: ${propertyId}`);
          resolve(false);
        } else {
          console.log(`New property analysis this session: ${propertyId}`);
          const updatedIds = [...analysedPropertyIds, propertyId];

          // Use await to ensure the storage is updated before resolving
          await new Promise<void>((setResolve) => {
            chrome.storage.session.set(
              { [StorageKeys.VESTA_GA_ANALYSED_PROPERTY_IDS_SESSION]: updatedIds },
              () => {
                if (chrome.runtime.lastError) {
                  logErrorToSentry(
                    `Error setting ${StorageKeys.VESTA_GA_ANALYSED_PROPERTY_IDS_SESSION} in chrome.storage.session:`,
                    "error"
                  );
                }
                setResolve();
              }
            );
          });

          resolve(true);
        }
      }
    );
  });
}

/**
 * Navigates to the pricing page on the static site, appending the GA Client ID as a query parameter.
 * This is used to track the source of the user's purchase.
 */
export async function navigateToPricingPageWithGaParams(): Promise<void> {
  try {
    const extensionClientId = await getOrCreateClientId();
    const encodedExtClientId = encodeURIComponent(extensionClientId);

    const authPricingUrl = ENV_CONFIG.AUTH_PRICING_URL;
    const hashIndex = authPricingUrl.indexOf("#");

    const baseUrl = hashIndex !== -1 ? authPricingUrl.substring(0, hashIndex) : authPricingUrl;
    const fragment = hashIndex !== -1 ? authPricingUrl.substring(hashIndex) : "";

    const separator = baseUrl.includes("?") ? "&" : "?";
    const urlWithGaParam = `${baseUrl}${separator}${QUERY_PARAM_KEYS.EXTENSION_CLIENT_ID}=${encodedExtClientId}`;

    const finalUrl = `${urlWithGaParam}${fragment}`;
    chrome.tabs.create({ url: finalUrl });
  } catch (error) {
    console.error("[GAHelpers] Error constructing pricing page URL with GA params:", error);
    // Fallback to opening the original URL if there's an error during client ID processing
    chrome.tabs.create({ url: ENV_CONFIG.AUTH_PRICING_URL });
  }
}
