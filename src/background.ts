import { exchangeCodeForTokens, storeAuthTokens } from "@/background/authHelpers";
import { ActionEvents } from "./constants/actionEvents";
import { ENV_CONFIG } from "./constants/environmentConfig";
import { StorageKeys } from "./constants/storage";
import {
  MessageRequest,
  NavigatedUrlOrTabChangedOrExtensionOpenedMessage,
  ResponseType,
  ShowWarningMessage,
} from "./types/messages";
import { initSentry, logErrorToSentry } from "./utils/sentry";

console.log("[background.ts] Background script loaded");
// Background.ts is the central hub
// Listens for messages from the sidebar or content script.
// Sends commands to the content script to scrape data.
// Relays data between the content script and sidebar.
initSentry();

/**
 * Creates a system notification for important background events
 *
 * Used for cross-tab notifications that need to be visible
 * even when the extension UI isn't focused
 */
function showSystemNotification(title: string, message: string) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "/images/icon128.png",
    title,
    message,
  });
}

function sendWarningMessage(logMessage: string) {
  console.warn(logMessage);
  const warningMessage: ShowWarningMessage = {
    action: ActionEvents.SHOW_WARNING,
    data: "Please open a property page on rightmove.co.uk.",
  };
  chrome.runtime.sendMessage<ShowWarningMessage, ResponseType>(warningMessage, (response) => {
    if (chrome.runtime.lastError) {
      logErrorToSentry(chrome.runtime.lastError);
    } else {
      console.log("[background.ts] Warning message sent successfully:", response);
    }
  });
}

function processTab(tab: chrome.tabs.Tab, sendResponse: (response: ResponseType) => void) {
  const currentUrl = tab.url;
  const tabId = tab.id;
  if (!currentUrl || typeof tabId !== "number") {
    console.warn("Tab has no valid URL or ID");
    sendResponse({ status: "Tab has no valid URL or ID" });
    return;
  }

  // If the URL is one of the disallowed types, send a warning immediately.
  if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("about:")) {
    sendWarningMessage("Internal Chrome page detected. Sending warning directly.");
    sendResponse({ status: "Internal Chrome page detected" });
    return;
  }

  // Validate if the URL matches a Rightmove property page.
  const validRightmoveRegex =
    /^https:\/\/www\.rightmove\.co\.uk\/(properties\/|property-for-sale\/|property-to-rent\/)/;
  if (!validRightmoveRegex.test(currentUrl)) {
    sendWarningMessage("Please open a property page on rightmove.co.uk.");
    sendResponse({ status: "URL not matching target domain" });
    return;
  }

  // If the URL is valid, forward a message to the content script.
  const message: NavigatedUrlOrTabChangedOrExtensionOpenedMessage = {
    action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
    data: currentUrl,
  };

  console.log("[background.ts] Sending message to tab:", tabId, message);
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      logErrorToSentry(chrome.runtime.lastError);
      if (chrome.runtime.lastError?.message?.includes("Could not establish connection")) {
        sendWarningMessage("Content script not loaded. Sending warning directly.");
      }
      sendResponse({ status: "Error sending message to tab" });
    } else {
      console.log("[background.ts] Message sent successfully:", response);
      sendResponse({ status: "Message sent successfully" });
    }
  });
}

// This event handles when the user switches to a different tab.
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    processTab(tab, (response) => {
      console.log("[background.ts] onActivated response:", response);
    });
  });
});

// This event handles URL changes (e.g. when navigating within a tab).
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    processTab(tab, (response) => {
      console.log("[background.ts] onUpdated response:", response);
    });
  }
});

// When the side panel is opened, query for the active tab and process it.
chrome.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
  if (request.action === ActionEvents.SIDE_PANEL_OPENED) {
    console.log("[background.ts] Side panel opened");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        processTab(tabs[0], (response) => {
          console.log("[background.ts] SIDE_PANEL_OPENED response:", response);
        });
      }
    });
    sendResponse({ status: "Handled side panel opened" });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(
    "[background.ts] Received message:",
    request.action,
    "from:",
    sender.id,
    "tab:",
    sender.tab?.id
  );

  // Determine the source and intended target of the message
  const isFromSidePanel =
    sender.url?.includes(chrome.runtime.id) && sender.url?.includes("sidepanel.html");

  // Messages FROM Content Script or Background TO Side Panel (UI Updates)
  if (
    !isFromSidePanel && // Don't forward messages from side panel back to itself
    (request.action === ActionEvents.PROPERTY_PAGE_OPENED ||
      request.action === ActionEvents.SHOW_WARNING ||
      request.action === ActionEvents.AUTHENTICATION_COMPLETE ||
      request.action === ActionEvents.LOGOUT_COMPLETE)
  ) {
    console.log(`[background.ts] Forwarding message to UI (SidePanel): ${request.action}`);
    chrome.runtime.sendMessage(request, (response) => {
      // Send to potentially multiple listeners (Side Panel)
      if (chrome.runtime.lastError) {
        logErrorToSentry(
          `Error forwarding message ${request.action} to UI: ${chrome.runtime.lastError.message}`,
          "warning"
        );
      } else {
        console.log(`[background.ts] Forwarded ${request.action} to UI. Response:`, response);
      }
    });
    sendResponse({ status: `Message ${request.action} forwarded to UI` });
    return false; // Message forwarding itself is sync
  }

  // Message FROM Side Panel TO Background (Get Auth Status)
  if (isFromSidePanel && request.action === ActionEvents.GET_AUTH_STATUS) {
    console.log("[background.ts] Handling GET_AUTH_STATUS from SidePanel.");
    chrome.storage.local.get([StorageKeys.AUTH_ID_TOKEN], (result) => {
      const hasToken = !!result[StorageKeys.AUTH_ID_TOKEN];
      sendResponse({ isAuthenticated: hasToken });
    });
    return true; // Async storage access
  }

  // Side Panel opened event (Special case, triggered by Side Panel)
  if (request.action === ActionEvents.SIDE_PANEL_OPENED) {
    console.log("[background.ts] Handling SIDE_PANEL_OPENED.");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        processTab(tabs[0], (processTabResponse) => {
          sendResponse({ status: "Processed active tab.", processTabResponse });
        });
      } else {
        sendResponse({ status: "No active tab found." });
      }
    });
    return true; // Async processTab
  }

  // Image Fetching (Initiated by Side Panel, handled by Background)
  if (request.action === ActionEvents.FETCH_IMAGE_FOR_CANVAS) {
    console.log("[background.ts] Handling FETCH_IMAGE_FOR_CANVAS.");
    if (request.url) {
      fetch(request.url)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => sendResponse({ success: true, dataUrl: reader.result });
          reader.onerror = (error) => {
            // Ensure error is thrown or handled to trigger catch
            console.error("FileReader error:", error);
            throw new Error("FileReader error occurred");
          };
          reader.readAsDataURL(blob);
        })
        .catch((error) => {
          const errorMsg = error instanceof Error ? error.message : "Failed to fetch image.";
          logErrorToSentry(
            `Failed to fetch image (for canvas): ${request.url} - ${errorMsg}`,
            "error"
          );
          sendResponse({ success: false, error: errorMsg });
        });
      return true; // Async fetch
    } else {
      sendResponse({ success: false, error: "Missing URL." });
      return false;
    }
  }

  // Default case for unhandled actions
  console.warn(
    `[background.ts] Unhandled/misdirected action: ${request.action} from sender ID ${sender.id}`
  );
  // Optional: send a generic response for unhandled cases if needed
  // sendResponse({ status: `Action ${request.action} not handled by background.` });
  return false; // Assume sync handling if not explicitly returned true
});

// Auth Listener for redirect URL
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    console.log(`[Auth Listener] Status complete for URL: ${tab.url}`); // Log URL being checked
    const redirectUri = ENV_CONFIG.REDIRECT_URI;
    if (tab.url.split("?")[0] === redirectUri) {
      console.log(`[Auth Listener] Detected redirect URI: ${tab.url}`); // Log redirect detected
      const url = new URL(tab.url);
      const code = url.searchParams.get("code");

      if (code) {
        console.log(`[Auth Listener] Auth code received: ${code}`); // Log received code
        showSystemNotification("Vesta", "Processing authentication...");
        try {
          console.log("[Auth Listener] Attempting to retrieve code verifier from storage...");
          const storageResult = await chrome.storage.local.get([StorageKeys.AUTH_CODE_VERIFIER]);
          const codeVerifier = storageResult[StorageKeys.AUTH_CODE_VERIFIER];

          if (!codeVerifier) {
            console.error("[Auth Listener] CRITICAL: Missing code verifier in storage.");
            throw new Error("Missing code verifier in storage.");
          }
          console.log("[Auth Listener] Code verifier found:", codeVerifier ? "Exists" : "MISSING!"); // Log verifier found

          console.log("[Auth Listener] Attempting to exchange code for tokens...");
          const tokenResponse = await exchangeCodeForTokens(code, codeVerifier);
          console.log(
            "[Auth Listener] exchangeCodeForTokens successful. Response received (tokens exist):",
            {
              id_token: !!tokenResponse.id_token,
              access_token: !!tokenResponse.access_token,
              refresh_token: !!tokenResponse.refresh_token,
            }
          ); // Log success + existence of tokens

          console.log("[Auth Listener] Attempting to store tokens...");
          await storeAuthTokens(tokenResponse);
          console.log("[Auth Listener] storeAuthTokens successful."); // Log token storage success

          console.log("[Auth Listener] Tokens stored successfully. Notifying UI.");
          // Notify the UI about successful authentication
          chrome.runtime.sendMessage({
            action: ActionEvents.AUTHENTICATION_COMPLETE,
            data: { isAuthenticated: true },
          });
          // Close the auth tab
          console.log(`[Auth Listener] Closing auth tab: ${tabId}`);
          chrome.tabs.remove(tabId);
          showSystemNotification("Vesta", "Authentication successful!");
        } catch (error) {
          console.error("[Auth Listener] Error during token exchange/storage process:", error); // Log the actual error
          logErrorToSentry(
            `Error exchanging code for tokens: ${error instanceof Error ? error.message : String(error)}`,
            "error"
          );
          showSystemNotification("Vesta", "Authentication failed. Please try again.");
        }
      } else {
        const error = url.searchParams.get("error");
        if (error) {
          console.error(`[Auth Listener] Authentication error parameter found in URL: ${error}`); // Log error from URL parameter
          logErrorToSentry(`Authentication error from provider: ${error}`, "error");
          showSystemNotification("Vesta", `Authentication failed: ${error}`);
          // Handle error display, maybe close tab or redirect
          console.log(`[Auth Listener] Closing auth tab due to error parameter: ${tabId}`);
          chrome.tabs.remove(tabId);
        } else {
          console.warn(
            `[Auth Listener] Redirect URI detected, but no 'code' or 'error' parameter found in URL: ${tab.url}`
          ); // Log if no code/error
        }
      }
    } else {
      // Optional: Log URLs that are 'complete' but don't match the redirect URI
      // console.log(`[Auth Listener] URL complete but not the redirect URI: ${tab.url}`);
    }
  }
});
