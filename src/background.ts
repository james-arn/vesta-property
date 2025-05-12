import { exchangeCodeForTokens, storeAuthTokens } from "@/background/authHelpers";
import { ActionEvents } from "./constants/actionEvents";
import { ENV_CONFIG } from "./constants/environmentConfig";
import { RIGHTMOVE_PROPERTY_PAGE_REGEX } from "./constants/regex";
import { StorageKeys } from "./constants/storage";
import {
  NavigatedUrlOrTabChangedOrExtensionOpenedMessage,
  ResponseType,
  ShowWarningMessage,
} from "./types/messages";
import { logErrorToSentry } from "./utils/sentry";

console.log("[background.ts] Service Worker loaded and running.");

// Set the panel behavior to open on action click (clicking the extension icon)
// This should be at the top level to be registered when the service worker starts.
function configureSidePanel() {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .then(() => {
        console.log("[background.ts] Side panel configured to open on action click.");
      })
      .catch((error) =>
        logErrorToSentry(
          `chrome.sidePanel.setPanelBehavior configuration error: ${error instanceof Error ? error.message : String(error)}`,
          "error"
        )
      );
  } else {
    logErrorToSentry("chrome.sidePanel.setPanelBehavior API not available.", "warning");
  }
}

// Configure on installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[background.ts] Extension installed or updated:", details.reason);
  configureSidePanel();
  // Perform any other first-time setup or migration tasks here
});

// Also configure on startup to ensure it's always set
configureSidePanel();

// Background.ts is the central hub
// Listens for messages from the sidebar or content script.
// Sends commands to the content script to scrape data.
// Relays data between the content script and sidebar.

// Removed sentry for MVP, reduce permissions required by extension
// initSentry();

/**
 * Creates a system notification for important background events
 *
 * Used for cross-tab notifications that need to be visible
 * even when the extension UI isn't focused
 */
function showSystemNotification(title: string, message: string) {
  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: "images/icon128.png", // Relative to extension root
      title,
      message,
    },
    (notificationId) => {
      if (chrome.runtime.lastError) {
        logErrorToSentry(
          `System notification error: ${chrome.runtime.lastError.message}`,
          "warning"
        );
      }
    }
  );
}

function sendWarningMessage(logMessage: string, tabId?: number) {
  console.warn(`[WarningService] ${logMessage}`, tabId ? `(for tab: ${tabId})` : "");
  const warningPayload: ShowWarningMessage = {
    action: ActionEvents.SHOW_WARNING,
    data: "Please open a property page on rightmove.co.uk to use all features.", // Generic user-facing message
  };
  chrome.runtime.sendMessage(warningPayload, (response) => {
    if (chrome.runtime.lastError) {
      logErrorToSentry(
        `Error sending warning to runtime: ${chrome.runtime.lastError.message}`,
        "warning"
      );
    }
  });
  if (tabId) {
    chrome.tabs.sendMessage(tabId, warningPayload, (response) => {
      if (chrome.runtime.lastError) {
        if (!chrome.runtime.lastError.message?.includes("Could not establish connection")) {
          logErrorToSentry(
            `Error sending warning to tab ${tabId}: ${chrome.runtime.lastError.message}`,
            "warning"
          );
        }
      }
    });
  }
}

function processTab(tab: chrome.tabs.Tab, sendResponse?: (response: ResponseType) => void) {
  const { url: currentUrl, id: tabId } = tab;

  if (!currentUrl || typeof tabId !== "number") {
    logErrorToSentry("[processTab] Invalid tab data received.", "warning");
    sendResponse?.({ status: "Invalid tab data for processing" });
    return;
  }

  // console.log(`[processTab] Processing tab ${tabId}, URL: ${currentUrl}`); // Kept for targeted debugging if needed

  if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("about:")) {
    // No action needed for internal pages, not a warning state for the user necessarily.
    sendResponse?.({ status: "Internal Chrome page. No action taken." });
    return;
  }

  if (!RIGHTMOVE_PROPERTY_PAGE_REGEX.test(currentUrl)) {
    sendWarningMessage("Not a Rightmove property page", tabId);
    sendResponse?.({ status: "URL not a Rightmove property page" });
    return;
  }

  const messageToContentScript: NavigatedUrlOrTabChangedOrExtensionOpenedMessage = {
    action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
    data: currentUrl,
  };

  // console.log("[processTab] Dispatching TAB_CHANGED_OR_EXTENSION_OPENED to tab:", tabId); // Keep for debugging if tab updates seem problematic
  chrome.tabs.sendMessage(tabId, messageToContentScript, (response) => {
    if (chrome.runtime.lastError) {
      if (!chrome.runtime.lastError.message?.includes("Could not establish connection")) {
        logErrorToSentry(
          `[processTab] sendMessage to tab ${tabId} failed: ${chrome.runtime.lastError.message}`,
          "warning"
        );
      }
    }
  });

  sendResponse?.({ status: "TAB_CHANGED_OR_EXTENSION_OPENED dispatched." });
}

// AUTH REDIRECT LISTENER
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const redirectUri = ENV_CONFIG.REDIRECT_URI;
    if (tab.url.startsWith(redirectUri)) {
      console.log("[Auth Listener] Detected auth redirect URI:", tab.url);
      const url = new URL(tab.url);
      const code = url.searchParams.get("code");

      if (code) {
        showSystemNotification("Vesta", "Processing authentication...");
        try {
          const storageResult = await chrome.storage.local.get([StorageKeys.AUTH_CODE_VERIFIER]);
          const codeVerifier = storageResult[StorageKeys.AUTH_CODE_VERIFIER];
          if (!codeVerifier) throw new Error("Auth code verifier not found in storage.");

          const tokenResponse = await exchangeCodeForTokens(code, codeVerifier);
          await storeAuthTokens(tokenResponse);

          chrome.runtime.sendMessage(
            {
              action: ActionEvents.AUTHENTICATION_COMPLETE,
              data: { isAuthenticated: true },
            },
            (response) => {
              if (chrome.runtime.lastError)
                logErrorToSentry(
                  `Error sending AUTHENTICATION_COMPLETE: ${chrome.runtime.lastError.message}`,
                  "error"
                );
            }
          );

          chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError)
              logErrorToSentry(
                `Error removing auth tab ${tabId}: ${chrome.runtime.lastError.message}`,
                "warning"
              );
          });
          showSystemNotification("Vesta", "Authentication successful!");
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logErrorToSentry(`Authentication processing error: ${errorMsg}`, "error");
          showSystemNotification("Vesta", `Authentication failed: ${errorMsg}. Please try again.`);
        }
      } else {
        const errorParam = url.searchParams.get("error");
        if (errorParam) {
          logErrorToSentry(`Authentication error from provider: ${errorParam}`, "error");
          showSystemNotification("Vesta", `Authentication failed: ${errorParam}`);
          chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError)
              logErrorToSentry(
                `Error removing auth tab ${tabId} (with error param): ${chrome.runtime.lastError.message}`,
                "warning"
              );
          });
        } else {
          // Not necessarily an error, could be other query params on the redirect URI if flow changes.
          console.warn(
            "[Auth Listener] Auth redirect URI did not contain 'code' or 'error' parameter:",
            tab.url
          );
        }
      }
      return; // Explicitly stop further onUpdated listeners for this auth redirect URL update.
    }
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  // console.log("[tabs.onActivated] Tab activated:", activeInfo.tabId); // Keep for debugging tab activation
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) {
      logErrorToSentry(
        `tabs.onActivated.get error: ${chrome.runtime.lastError.message}`,
        "warning"
      );
      return;
    }
    if (tab && tab.url && tab.id) {
      // Ensure tab, tab.url, and tab.id exist
      processTab(tab);
    } else {
      logErrorToSentry("[tabs.onActivated] Tab or essential tab properties not found", "warning");
    }
  });
});

// General tab updates (e.g., URL change in an active tab, new tab navigation complete)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.startsWith(ENV_CONFIG.REDIRECT_URI)) {
    return; // Already handled by the dedicated auth listener.
  }
  if (changeInfo.status === "complete" && tab.active && tab.url && tab.id) {
    // console.log(`[tabs.onUpdated - General] Tab ${tabId} processed.`); // Keep for debugging tab updates
    processTab(tab);
  }
});

// Main message listener (for messages FROM content scripts or potentially other extension parts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const senderContext = sender.tab
    ? `tabId: ${sender.tab.id}${sender.frameId !== undefined ? `, frameId: ${sender.frameId}` : ""}`
    : sender.url || "extension context (e.g., side panel, popup)";
  // console.log("[onMessage] Received:", request.action, "from:", senderContext); // Verbose, remove for prod unless debugging messages

  const isFromSidePanel =
    !sender.tab &&
    sender.url?.includes(chrome.runtime.id) &&
    sender.url?.includes("sidepanel.html");

  // Forward specific messages to Side Panel UI (originated from content script or background)
  if (
    (sender.tab ||
      (sender.origin && sender.origin.startsWith("chrome-extension://") && !isFromSidePanel)) &&
    (request.action === ActionEvents.PROPERTY_PAGE_OPENED ||
      request.action === ActionEvents.SHOW_WARNING ||
      request.action === ActionEvents.AUTHENTICATION_COMPLETE ||
      request.action === ActionEvents.LOGOUT_COMPLETE)
  ) {
    // console.log(`[onMessage] Forwarding to UI (SidePanel): ${request.action}`);
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime.lastError)
        logErrorToSentry(
          `Error forwarding message to UI: ${chrome.runtime.lastError.message}`,
          "warning"
        );
    });
    return false; // No async response to the original sender of this forwarded message.
  }

  // Handle messages from Side Panel UI
  if (isFromSidePanel && request.action === ActionEvents.GET_AUTH_STATUS) {
    chrome.storage.local.get([StorageKeys.AUTH_ID_TOKEN], (result) => {
      if (chrome.runtime.lastError) {
        logErrorToSentry(
          `Storage get error for AUTH_ID_TOKEN: ${chrome.runtime.lastError.message}`,
          "error"
        );
        sendResponse({ isAuthenticated: false, error: "Failed to retrieve auth status" });
        return;
      }
      sendResponse({ isAuthenticated: !!result[StorageKeys.AUTH_ID_TOKEN] });
    });
    return true; // Async response
  }

  if (request.action === ActionEvents.REQUEST_OPEN_SIDE_PANEL) {
    if (
      sender.tab &&
      typeof sender.tab.id === "number" &&
      typeof sender.tab.windowId === "number"
    ) {
      const tabIdToOpen = sender.tab.id;
      const windowIdToOpenIn = sender.tab.windowId;
      const sidePanelPath = `sidepanel.html?tabId=${tabIdToOpen}`;

      console.log(
        `[onMessage] REQUEST_OPEN_SIDE_PANEL: Configuring for tabId ${tabIdToOpen}, preparing to open in windowId ${windowIdToOpenIn}`
      );

      // Set options (this is async but we don't wait for its promise before trying to open)
      chrome.sidePanel
        .setOptions({
          tabId: tabIdToOpen,
          path: sidePanelPath,
          enabled: true,
        })
        .catch((error) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logErrorToSentry(
            `sidePanel.setOptions error (non-blocking for open attempt) for tab ${tabIdToOpen}: ${errorMsg}`,
            "warning"
          );
        });

      // Attempt to open the side panel more directly
      try {
        chrome.sidePanel
          .open({ windowId: windowIdToOpenIn })
          .then(() => {
            console.log(
              `[onMessage] chrome.sidePanel.open({ windowId: ${windowIdToOpenIn} }) promise resolved.`
            );
            sendResponse({ status: "Side panel open command issued successfully" });
          })
          .catch((error) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logErrorToSentry(
              `chrome.sidePanel.open({ windowId: ${windowIdToOpenIn} }) failed: ${errorMsg}`,
              "error"
            );
            sendResponse({
              status: "Error trying to open side panel via windowId",
              error: errorMsg,
            });
          });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logErrorToSentry(
          `Synchronous error calling chrome.sidePanel.open({ windowId: ${windowIdToOpenIn} }): ${errorMsg}`,
          "error"
        );
        sendResponse({
          status: "Synchronous error opening side panel via windowId",
          error: errorMsg,
        });
      }
    } else {
      const errorMsg = "REQUEST_OPEN_SIDE_PANEL lacked valid sender tab ID or window ID.";
      logErrorToSentry(errorMsg, "warning");
      sendResponse({ status: errorMsg });
    }
    return true; // Async response due to promise from open()
  }

  if (request.action === ActionEvents.SIDE_PANEL_OPENED) {
    // From Side Panel UI confirming it's ready
    console.log(
      "[onMessage] SIDE_PANEL_OPENED (from UI) received.",
      request.tabId ? `Targeting tab: ${request.tabId}` : "No specific tabId from side panel."
    );
    if (request.tabId && typeof request.tabId === "number") {
      const targetTabId = request.tabId;
      // Relay to the specific content script that its side panel is open
      chrome.tabs.sendMessage(
        targetTabId,
        { action: ActionEvents.SIDE_PANEL_OPENED },
        (response) => {
          if (chrome.runtime.lastError) {
            // It's possible the content script isn't there or ready, especially if the page isn't a property page
            // or if the extension was just reloaded and page not refreshed.
            if (!chrome.runtime.lastError.message?.includes("Could not establish connection")) {
              logErrorToSentry(
                `Error sending SIDE_PANEL_OPENED to content script tab ${targetTabId}: ${chrome.runtime.lastError.message}`,
                "warning"
              );
            }
          } else {
            console.log(
              `[background.ts] Successfully relayed SIDE_PANEL_OPENED to content script in tab ${targetTabId}. Response:`,
              response
            );
          }
        }
      );

      // Also, trigger the existing processTab logic for this tab
      chrome.tabs.get(targetTabId, (tab) => {
        if (chrome.runtime.lastError) {
          logErrorToSentry(
            `tabs.query error for SIDE_PANEL_OPENED (tabId from side panel): ${chrome.runtime.lastError.message}`,
            "warning"
          );
          sendResponse?.({ status: "Error querying tab specified by side panel" });
          return;
        }
        if (tab && tab.id && tab.url) {
          processTab(tab, sendResponse);
        } else {
          logErrorToSentry(
            `[onMessage] No tab or essential tab properties found for tabId ${targetTabId} from SIDE_PANEL_OPENED.`,
            "warning"
          );
          sendResponse?.({ status: "Tab specified by side panel not found or lacks URL" });
        }
      });
    } else {
      // Fallback or error if tabId wasn't provided by side panel - this shouldn't happen with the App.tsx change
      logErrorToSentry(
        "[onMessage] SIDE_PANEL_OPENED received from UI without a valid tabId. Cannot relay to content script or process tab.",
        "warning"
      );
      sendResponse?.({ status: "SIDE_PANEL_OPENED lacked tabId from UI" });
    }
    return true; // Async response
  } else if (request.action === ActionEvents.SIDE_PANEL_IS_NOW_CLOSING) {
    // From Side Panel UI (via beforeunload) confirming it's closing
    console.log(
      "[onMessage] SIDE_PANEL_IS_NOW_CLOSING (from UI) received.",
      request.tabId ? `For tab: ${request.tabId}` : "No specific tabId from side panel."
    );
    if (request.tabId && typeof request.tabId === "number") {
      const targetTabId = request.tabId;
      // Relay to the specific content script that its side panel is closing
      chrome.tabs.sendMessage(
        targetTabId,
        { action: ActionEvents.SIDE_PANEL_IS_NOW_CLOSING },
        (response) => {
          if (chrome.runtime.lastError) {
            if (!chrome.runtime.lastError.message?.includes("Could not establish connection")) {
              logErrorToSentry(
                `Error sending SIDE_PANEL_IS_NOW_CLOSING to content script tab ${targetTabId}: ${chrome.runtime.lastError.message}`,
                "warning"
              );
            }
          } else {
            console.log(
              `[background.ts] Successfully relayed SIDE_PANEL_IS_NOW_CLOSING to content script in tab ${targetTabId}. Response:`,
              response
            );
          }
        }
      );
      sendResponse?.({ status: "SIDE_PANEL_IS_NOW_CLOSING relayed to content script" });
    } else {
      logErrorToSentry(
        "[onMessage] SIDE_PANEL_IS_NOW_CLOSING received from UI without a valid tabId. Cannot relay.",
        "warning"
      );
      sendResponse?.({ status: "SIDE_PANEL_IS_NOW_CLOSING lacked tabId from UI" });
    }
    return true; // Async response possible if sendResponse is used
  } else if (request.action === ActionEvents.REQUEST_SIDE_PANEL_CLOSE_ACTION) {
    console.log(
      "[background.ts] Received REQUEST_SIDE_PANEL_CLOSE_ACTION from tab:",
      sender.tab?.id
    );
    if (sender.tab?.id) {
      // Send a message that any part of the extension can listen to (e.g., the side panel UI).
      // The side panel UI will then check if the targetTabId matches its own.
      chrome.runtime.sendMessage(
        {
          action: ActionEvents.BACKGROUND_COMMANDS_SIDE_PANEL_CLOSE,
          targetTabId: sender.tab.id, // The side panel needs this to identify if it's the target.
        },
        (response) => {
          // This callback is for the send operation itself.
          // The side panel does not send a response to BACKGROUND_COMMANDS_SIDE_PANEL_CLOSE.
          // "The message port closed before a response was received" is expected here if the side panel
          // doesn't call sendResponse, which it shouldn't for this command.
          if (chrome.runtime.lastError) {
            if (
              !chrome.runtime.lastError.message?.includes(
                "The message port closed before a response was received"
              )
            ) {
              logErrorToSentry(
                `Error sending BACKGROUND_COMMANDS_SIDE_PANEL_CLOSE: ${chrome.runtime.lastError.message}`,
                "warning"
              );
            }
          }
        }
      );
      // Respond to the pull tab that the command has been dispatched.
      // The pull tab isn't currently waiting for this response but it's good practice.
      sendResponse?.({ status: "BACKGROUND_COMMANDS_SIDE_PANEL_CLOSE dispatched" });
    } else {
      logErrorToSentry("No tab ID found in sender for REQUEST_SIDE_PANEL_CLOSE_ACTION", "warning");
      sendResponse?.({ status: "Error: No tab ID for close action" });
    }
    return true; // Indicates that sendResponse might be called.
  }

  if (request.action === ActionEvents.FETCH_IMAGE_FOR_CANVAS) {
    if (!request.url) {
      logErrorToSentry("FETCH_IMAGE_FOR_CANVAS missing URL", "warning");
      sendResponse({ success: false, error: "Missing URL for image fetch." });
      return false;
    }
    fetch(request.url)
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status} for ${request.url}`);
        return response.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ success: true, dataUrl: reader.result });
        reader.onerror = (event) => {
          logErrorToSentry("FileReader error in FETCH_IMAGE_FOR_CANVAS", "error");
          sendResponse({ success: false, error: "FileReader error occurred." });
        };
        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        const errorMsg =
          error instanceof Error ? error.message : "Failed to fetch image for canvas.";
        logErrorToSentry(errorMsg, "error");
        sendResponse({ success: false, error: errorMsg });
      });
    return true; // Async fetch
  }

  // If a message is not handled by any of the specific handlers above:
  // console.warn(`[onMessage] Unhandled message action: ${request?.action} from ${senderContext}`);
  // sendResponse({ status: "Action not handled by background script" }); // Optionally respond for unhandled cases
  return false; // Default to false if not returning true for async responses
});
