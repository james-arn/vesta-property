import { exchangeCodeForTokens, refreshTokens, storeAuthTokens } from "@/background/authHelpers";
import { ENV_CONFIG } from "@/constants/environmentConfig";
import { ActionEvents } from "./constants/actionEvents";
import { StorageKeys } from "./constants/storage";
import {
  MessageRequest,
  NavigatedUrlOrTabChangedOrExtensionOpenedMessage,
  ResponseType,
  ShowWarningMessage,
  UpdatePropertyDataMessage,
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

function handleToContentScriptFromUIMessage(
  request: MessageRequest,
  sendResponse: (response: ResponseType) => void
) {
  const { action, data } = request;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0 || !tabs[0].id) {
      logErrorToSentry("background.ts: No active tab found.", "warning");
      sendResponse({ status: "No active tab found" });
      return;
    }
    const tabId = tabs[0].id;

    switch (action) {
      case ActionEvents.FILL_RIGHTMOVE_CONTACT_FORM:
        const { emailAgentUrl, selectedWarningItems } = data;
        chrome.tabs.sendMessage(tabId, {
          action: ActionEvents.NAVIGATE_TO_CONTACT_AGENT_PAGE,
          data: {
            url: `https://www.rightmove.co.uk${emailAgentUrl}`,
            selectedWarningItems,
          },
        });
        break;

      case ActionEvents.NAVIGATE_BACK_TO_PROPERTY_LISTING:
        const { url } = data;
        chrome.tabs.sendMessage(tabId, {
          action: ActionEvents.NAVIGATE_BACK_TO_PROPERTY_LISTING,
          data: {
            url,
          },
        });
        break;

      default:
        console.warn("Unhandled action type:", action);
    }
    sendResponse({ status: "Message recieved in background.ts" });
  });
}

function handleToUIFromContentScriptMessage(
  request: MessageRequest,
  sendResponse: (response: ResponseType) => void
) {
  if (request.action === ActionEvents.UPDATE_PROPERTY_DATA) {
    console.log("[background.ts] Property Data:", request.data);
    chrome.runtime.sendMessage<UpdatePropertyDataMessage, ResponseType>(
      request as UpdatePropertyDataMessage,
      (response) => {
        if (chrome.runtime.lastError) {
          logErrorToSentry(chrome.runtime.lastError);
        }
        console.log("[background.ts] Message forwarded to UI:", request);
        console.log("[background.ts] Response:", response);
        sendResponse({ status: "Property data update handled" });
      }
    );
  }

  if (request.action === ActionEvents.SHOW_WARNING) {
    console.log("[background.ts] Warning Message:", request.data);
    chrome.runtime.sendMessage<ShowWarningMessage, ResponseType>(
      request as ShowWarningMessage,
      () => {
        if (chrome.runtime.lastError) {
          logErrorToSentry(chrome.runtime.lastError);
        } else {
          console.log("[background.ts] Message forwarded to UI:", request);
        }
      }
    );
    sendResponse({ status: "Warning message handled" });
  }
  if (request.action === ActionEvents.RIGHTMOVE_SIGN_IN_PAGE_OPENED) {
    console.log("[background.ts] Rightmove sign in message received");
    chrome.runtime.sendMessage(request, () => {
      if (chrome.runtime.lastError) {
        logErrorToSentry(chrome.runtime.lastError);
      } else {
        console.log("[background.ts] Message forwarded to UI:", request);
      }
    });
    sendResponse({ status: "Rightmove sign in page opened handled" });
  }
  if (request.action === ActionEvents.RIGHTMOVE_SIGN_IN_COMPLETED) {
    console.log("[background.ts] Rightmove sign in completed message received");
    chrome.runtime.sendMessage(request, () => {
      if (chrome.runtime.lastError) {
        logErrorToSentry(chrome.runtime.lastError);
      } else {
        console.log("[background.ts] Message forwarded to UI:", request);
      }
    });
    sendResponse({ status: "Rightmove sign in completed handled" });
  }
}

// Listen for messages from the content script and store data.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Messages for the UI
  if (
    request.action === ActionEvents.UPDATE_PROPERTY_DATA ||
    request.action === ActionEvents.SHOW_WARNING ||
    request.action === ActionEvents.RIGHTMOVE_SIGN_IN_PAGE_OPENED ||
    request.action === ActionEvents.RIGHTMOVE_SIGN_IN_COMPLETED
  ) {
    handleToUIFromContentScriptMessage(request, sendResponse);
  }

  // Messages for the Content Script
  if (
    request.action === ActionEvents.FILL_RIGHTMOVE_CONTACT_FORM ||
    request.action === ActionEvents.NAVIGATE_BACK_TO_PROPERTY_LISTING
  ) {
    handleToContentScriptFromUIMessage(request, sendResponse);
  }

  // Listen for form submission messages from the content script
  if (request.action === ActionEvents.AGENT_CONTACT_FORM_SUBMITTED) {
    console.log("[background.ts] Form submitted message received");
    // Forward the message to the React app
    chrome.runtime.sendMessage({
      action: ActionEvents.AGENT_CONTACT_FORM_SUBMITTED,
    });
    sendResponse({ status: "Agent contact form submitted handled" });
  }

  // Handle token refresh requests from the useSecureAuthentication hook
  if (request.action === ActionEvents.REFRESH_TOKENS && request.refreshToken) {
    console.log("[background.ts] Received token refresh request");

    // Refresh the tokens asynchronously
    (async () => {
      try {
        // Get new tokens using the refresh token
        const tokenResponse = await refreshTokens(request.refreshToken);

        // Store the new tokens
        await storeAuthTokens(tokenResponse);

        console.log("[background.ts] Token refresh successful");
        sendResponse({ success: true });
      } catch (error) {
        logErrorToSentry(error, "error");
        console.error("[background.ts] Token refresh failed:", error);
        sendResponse({ success: false, error: String(error) });
      }
    })();

    // Keep the message channel open for the async response
    return true;
  }

  // Handle AUTH_CODE_RECEIVED message from login-success.html
  if (request.type === ActionEvents.AUTH_CODE_RECEIVED && request.code) {
    console.log("[background.ts] Received auth code from login-success.html:", request.code);

    // Get the code verifier
    chrome.storage.local.get([StorageKeys.AUTH_CODE_VERIFIER], async (result) => {
      if (result[StorageKeys.AUTH_CODE_VERIFIER]) {
        try {
          // Exchange code for tokens
          const tokenResponse = await exchangeCodeForTokens(
            request.code,
            result[StorageKeys.AUTH_CODE_VERIFIER]
          );

          // Store tokens using the helper function
          await storeAuthTokens(tokenResponse);

          showSystemNotification(
            "Successfully Signed In",
            "You are now signed in to the Vesta Property Checker. You can start using all premium features."
          );
        } catch (error) {
          logErrorToSentry(error, "error");
          chrome.storage.local.set({
            [StorageKeys.AUTH_ERROR]: `Failed to exchange code for tokens: ${
              error instanceof Error ? error.message : String(error)
            }`,
            [StorageKeys.AUTH_IN_PROGRESS]: false,
          });
        }
      }
    });

    // Keep the message channel open for the async response
    return true;
  }

  // Handle AUTH_SUCCESS message from login-success.html or logout-success.html
  if (request.type === ActionEvents.AUTH_SUCCESS) {
    console.log("[background.ts] Received AUTH_SUCCESS message from redirect page");

    // The page will close itself, so we don't need to close it explicitly

    // If we have a tab ID in sender, let's track it for debugging
    if (sender.tab && sender.tab.id) {
      console.log("[background.ts] Authentication completed in tab:", sender.tab.id);
    }

    sendResponse({ status: "Auth success handled" });
  }

  // Handle LOGOUT_SUCCESS message from logout-success.js
  if (request.type === ActionEvents.LOGOUT_SUCCESS) {
    console.log("[background.ts] Received LOGOUT_SUCCESS message from logout page");

    // The page will close itself, so we don't need to close it explicitly

    // If we have a tab ID in sender, let's track it for debugging
    if (sender.tab && sender.tab.id) {
      console.log("[background.ts] Logout completed in tab:", sender.tab.id);
    }

    sendResponse({ status: "Logout success handled" });
  }
});

// Listen for tab switches
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Get the active tab's URL
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      // Send the URL to the sidebar
      chrome.runtime.sendMessage<NavigatedUrlOrTabChangedOrExtensionOpenedMessage, ResponseType>({
        action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
        data: tab.url,
      });
    }
  });
});

// Optionally, listen for tab updates (e.g., when the page reloads or URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    chrome.runtime.sendMessage<NavigatedUrlOrTabChangedOrExtensionOpenedMessage, ResponseType>({
      action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
      data: tab.url ?? "",
    });
  }
});

// Handle additional token exchange code in the tab change event
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only proceed if we have a complete URL change
  if (changeInfo.status === "complete" && tab.url) {
    try {
      // Check if this is a Cognito redirect with an auth code
      if (tab.url.includes(ENV_CONFIG.REDIRECT_URI) && tab.url.includes("code=")) {
        console.log("[background.ts] Caught Cognito redirect with auth code in tab update");

        // Extract the authorization code from the URL
        const urlObj = new URL(tab.url);
        const code = urlObj.searchParams.get("code");
        const error = urlObj.searchParams.get("error");
        const errorDescription = urlObj.searchParams.get("error_description");

        if (code) {
          // Verify we're in the authentication flow and have a code verifier
          chrome.storage.local.get(
            [StorageKeys.AUTH_IN_PROGRESS, StorageKeys.AUTH_CODE_VERIFIER],
            async (result) => {
              if (result[StorageKeys.AUTH_IN_PROGRESS] && result[StorageKeys.AUTH_CODE_VERIFIER]) {
                try {
                  // Exchange code for tokens
                  const tokenResponse = await exchangeCodeForTokens(
                    code,
                    result[StorageKeys.AUTH_CODE_VERIFIER]
                  );

                  // Store tokens using the helper function
                  await storeAuthTokens(tokenResponse);

                  console.log("Authentication successful, tokens stored");
                  showSystemNotification(
                    "Successfully Signed In",
                    "You are now signed in to the Vesta Property Checker. You can start using all premium features."
                  );

                  // Close the tab once authentication is complete
                  setTimeout(() => {
                    chrome.tabs.remove(tabId);
                  }, 1000);
                } catch (error) {
                  logErrorToSentry(error, "error");
                  chrome.storage.local.set({
                    [StorageKeys.AUTH_ERROR]: `Failed to exchange code for tokens: ${error instanceof Error ? error.message : String(error)}`,
                    [StorageKeys.AUTH_IN_PROGRESS]: false,
                  });
                }
              }
            }
          );
        }
        // Separate handling for logout redirects
        else if (tab.url.includes(ENV_CONFIG.LOGOUT_URI)) {
          console.log("Detected logout redirect");

          // This is a post-logout redirect
          // No additional action needed - the logout has been completed by Cognito
          // and the tokens have been cleared by our app
          // Tab will be closed automatically by the page itself
        }
        // Handle authentication errors (could happen in either flow)
        else if (tab.url.includes("error=")) {
          const url = new URL(tab.url);
          const error = url.searchParams.get("error");
          const errorDescription = url.searchParams.get("error_description");

          logErrorToSentry(`Authentication error: ${error} - ${errorDescription}`, "error");

          chrome.storage.local.set({
            [StorageKeys.AUTH_ERROR]: `Authentication failed: ${errorDescription || error}`,
            [StorageKeys.AUTH_IN_PROGRESS]: false,
          });
        }
      }
    } catch (error) {
      console.error("[background.ts] Error handling tab update:", error);
    }
  }
});
