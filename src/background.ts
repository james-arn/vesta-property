import { lookupAddressFromHousePricesPage } from "@/background/addressLookupHelper";
import { exchangeCodeForTokens, storeAuthTokens } from "@/background/authHelpers";
import { convertEpcUrlToDataUrlIfHttp } from "./background/epcBackgroundHelpers";
import { fetchGovEpcCertificatesByPostcode } from "./background/govEpcService/govEpcFetcher";
import {
  findBestAddressMatchInGovCertificates,
  findBestGovEpcMatch,
  getPlausibleGovEpcMatches,
} from "./background/govEpcService/govEpcMatcher";
import { ActionEvents } from "./constants/actionEvents";
import { ENV_CONFIG } from "./constants/environmentConfig";
import { RIGHTMOVE_PROPERTY_PAGE_REGEX } from "./constants/regex";
import { StorageKeys } from "./constants/storage";
import { type EpcProcessorResult } from "./lib/epcProcessing";
import { GovEpcCertificate, GovEpcValidationMatch } from "./types/govEpcCertificate";
import {
  NavigatedUrlOrTabChangedOrExtensionOpenedMessage,
  ResponseType,
  ShowWarningMessage,
} from "./types/messages";
import {
  AddressSourceType,
  ConfidenceLevels,
  DataStatus,
  EpcDataSourceType,
  ExtractedPropertyScrapingData,
} from "./types/property";
import { trackGA4ExtensionInstall } from "./utils/GoogleAnalytics/googleAnalyticsEvents";
import { logErrorToSentry } from "./utils/sentry";

// Background.ts is the central hub
// Listens for messages from the sidebar or content script.
// Sends commands to the content script to scrape data.
// Relays data between the content script and sidebar.

// Session cache for GOV EPC postcode lookups
const govEpcPostcodeCache = new Map<string, GovEpcCertificate[] | null>();
// Map to store resolve functions for pending client PDF OCR requests
const pendingClientPdfOcrRequests = new Map<string, (result: EpcProcessorResult) => void>();
// Map to store resolve functions for pending client Image OCR requests
const pendingClientImageOcrRequests = new Map<string, (result: EpcProcessorResult) => void>();

// Set to track property IDs currently being processed to prevent concurrent runs
const processingPropertyIds = new Set<string>();

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

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[background.ts] Extension installed or updated:", details.reason);
  configureSidePanel();
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    await trackGA4ExtensionInstall();
  }
});

// Also configure on startup to ensure it's always set
configureSidePanel();

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
  const { url: currentUrl, id: tabId, status: tabStatus } = tab;

  // console.log(
  //   `[processTab START] Processing Tab ID: ${tabId}, Status: ${tabStatus}, URL: ${currentUrl}`
  // );

  if (!currentUrl || typeof tabId !== "number") {
    logErrorToSentry("[processTab] Invalid tab data received.", "warning");
    sendResponse?.({ status: "Invalid tab data for processing" });
    return;
  }

  if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("about:")) {
    // console.log(`[processTab] Ignoring internal page: ${currentUrl} (Tab ID: ${tabId})`);
    sendResponse?.({ status: "Internal Chrome page. No action taken." });
    return;
  }

  const isPropertyPage = RIGHTMOVE_PROPERTY_PAGE_REGEX.test(currentUrl);
  // console.log(`[processTab] Regex test result for ${currentUrl}: ${isPropertyPage}`);

  if (!isPropertyPage) {
    // console.log(
    //   `[processTab] URL failed regex test. Sending warning for Tab ID: ${tabId}, URL: ${currentUrl}`
    // );
    sendWarningMessage("Not a Rightmove property page", tabId);
    sendResponse?.({ status: "URL not a Rightmove property page" });
    return;
  }

  const messageToContentScript: NavigatedUrlOrTabChangedOrExtensionOpenedMessage = {
    action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
    data: currentUrl,
  };

  // console.log(
  //   `[processTab] Attempting to send TAB_CHANGED_OR_EXTENSION_OPENED to Tab ID: ${tabId}, Status: ${tabStatus}`
  // );

  chrome.tabs.sendMessage(tabId, messageToContentScript, (response) => {
    if (chrome.runtime.lastError) {
      // console.warn(
      //   `[processTab] sendMessage to Tab ID: ${tabId} failed. Error: ${chrome.runtime.lastError.message}`
      // );
      if (!chrome.runtime.lastError.message?.includes("Could not establish connection")) {
        logErrorToSentry(
          `[processTab] sendMessage to tab ${tabId} failed unexpectedly: ${chrome.runtime.lastError.message}`,
          "warning"
        );
      }
    } else {
      // console.log(
      //   `[processTab] Successfully sent TAB_CHANGED_OR_EXTENSION_OPENED to Tab ID: ${tabId}. Response:`,
      //   response
      // );
    }
  });

  // console.log(`[processTab END] Finished processing Tab ID: ${tabId}`);
  sendResponse?.({ status: "TAB_CHANGED_OR_EXTENSION_OPENED dispatch attempted." });
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
            { action: ActionEvents.AUTHENTICATION_COMPLETE, data: { isAuthenticated: true } },
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(
    "[Background Listener] Raw message received:",
    JSON.parse(JSON.stringify(message)),
    "from:",
    sender.url || sender.id
  );

  const senderContext = sender.tab
    ? `tabId: ${sender.tab.id}${sender.frameId !== undefined ? `, frameId: ${sender.frameId}` : ""}`
    : sender.url || "extension context (e.g., side panel, popup)";
  // console.log("[onMessage] Received:", message.action, "from:", senderContext); // Verbose, remove for prod unless debugging messages

  const isFromSidePanel =
    !sender.tab &&
    sender.url?.includes(chrome.runtime.id) &&
    sender.url?.includes("sidepanel.html");

  // Forward specific messages to Side Panel UI (originated from content script or background)
  if (
    (sender.tab ||
      (sender.origin && sender.origin.startsWith("chrome-extension://") && !isFromSidePanel)) &&
    (message.action === ActionEvents.PROPERTY_PAGE_OPENED ||
      message.action === ActionEvents.SHOW_WARNING ||
      message.action === ActionEvents.AUTHENTICATION_COMPLETE ||
      message.action === ActionEvents.LOGOUT_COMPLETE)
  ) {
    // console.log(`[onMessage] Forwarding to UI (SidePanel): ${message.action}`);
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError)
        logErrorToSentry(
          `Error forwarding message to UI: ${chrome.runtime.lastError.message}`,
          "warning"
        );
    });
    return false; // No async response to the original sender of this forwarded message.
  }

  // Handle messages from Side Panel UI
  if (isFromSidePanel && message.action === ActionEvents.GET_AUTH_STATUS) {
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

  if (message.action === ActionEvents.REQUEST_OPEN_SIDE_PANEL) {
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
        .setOptions({ tabId: tabIdToOpen, path: sidePanelPath, enabled: true })
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

  if (message.action === ActionEvents.SIDE_PANEL_OPENED) {
    // From Side Panel UI confirming it's ready
    console.log(
      "[onMessage] SIDE_PANEL_OPENED (from UI) received.",
      message.data?.tabId
        ? `Targeting tab: ${message.data.tabId}`
        : "No specific tabId from side panel."
    );
    if (message.data?.tabId && typeof message.data.tabId === "number") {
      const targetTabId = message.data.tabId;
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

      // Also, trigger the existing processTab logic for this tab AND notify runtime listeners
      chrome.tabs.get(targetTabId, (tab) => {
        if (chrome.runtime.lastError) {
          logErrorToSentry(
            `tabs.get error for SIDE_PANEL_OPENED (tabId from side panel): ${chrome.runtime.lastError.message}`,
            "warning"
          );
          // Ensure original sendResponse (if any) is called for the SIDE_PANEL_OPENED message
          sendResponse?.({ status: "Error querying tab specified by side panel" });
          return;
        }
        if (tab && tab.id && tab.url) {
          // 1. Continue to process tab for content script
          processTab(tab); // Removed sendResponse from here as it's handled below for the main message

          // 2. ALSO send TAB_CHANGED_OR_EXTENSION_OPENED to runtime for side panel listener
          console.log(
            `[background.ts] Directly sending TAB_CHANGED_OR_EXTENSION_OPENED to runtime for side panel. URL: ${tab.url}`
          );
          const runtimeMessage: NavigatedUrlOrTabChangedOrExtensionOpenedMessage = {
            action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
            data: tab.url, // Send the URL
          };
          chrome.runtime.sendMessage(runtimeMessage, (runtimeResponse) => {
            if (chrome.runtime.lastError) {
              // Side panel might not always be listening or respond, this can be noisy.
              if (
                !chrome.runtime.lastError.message?.includes("Could not establish connection") &&
                !chrome.runtime.lastError.message?.includes(
                  "The message port closed before a response was received"
                )
              ) {
                logErrorToSentry(
                  `Error sending TAB_CHANGED_OR_EXTENSION_OPENED to runtime: ${chrome.runtime.lastError.message}`,
                  "warning"
                );
              }
            } else {
              // console.log(
              //   "[background.ts] Runtime ACK for TAB_CHANGED_OR_EXTENSION_OPENED:",
              //   runtimeResponse
              // );
            }
          });
          // Respond to the original SIDE_PANEL_OPENED message
          sendResponse?.({
            status: "SIDE_PANEL_OPENED processed, processTab initiated, and runtime notified.",
          });
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
  } else if (message.action === ActionEvents.SIDE_PANEL_IS_NOW_CLOSING) {
    // From Side Panel UI (via beforeunload) confirming it's closing
    console.log(
      "[onMessage] SIDE_PANEL_IS_NOW_CLOSING (from UI) received.",
      message.data?.tabId ? `For tab: ${message.data.tabId}` : "No specific tabId from side panel."
    );
    if (message.data?.tabId && typeof message.data.tabId === "number") {
      const targetTabId = message.data.tabId;
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
  } else if (message.action === ActionEvents.REQUEST_SIDE_PANEL_CLOSE_ACTION) {
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

  if (message.action === ActionEvents.FETCH_IMAGE_FOR_CANVAS) {
    if (!message.url) {
      logErrorToSentry("FETCH_IMAGE_FOR_CANVAS missing URL", "warning");
      sendResponse({ success: false, error: "Missing URL for image fetch." });
      return true;
    }
    fetch(message.url)
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status} for ${message.url}`);
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

  if (message.action === ActionEvents.CONTENT_SCRIPT_PROPERTY_DATA_EXTRACTED) {
    handlePropertyDataExtraction(
      message.data as ExtractedPropertyScrapingData,
      sendResponse,
      sender.tab?.id
    );
    return true;
  }

  // Listen for results from client-side PDF OCR
  if (message.action === ActionEvents.CLIENT_PDF_OCR_RESULT) {
    const { requestId, result } = message.payload as {
      requestId: string;
      result: EpcProcessorResult;
    };
    console.log(
      `[BG Client OCR Result] Received CLIENT_PDF_OCR_RESULT for requestId: ${requestId}`,
      result
    );

    const pdfResolve = pendingClientPdfOcrRequests.get(requestId);
    if (pdfResolve) {
      console.log(
        `[BG Client OCR Result] Found matching PDF OCR request for ${requestId}. Resolving.`
      );
      pdfResolve(result);
      pendingClientPdfOcrRequests.delete(requestId);
      sendResponse({ status: "success", message: "PDF OCR result processed by background." });
      return true;
    }

    const imageResolve = pendingClientImageOcrRequests.get(requestId);
    if (imageResolve) {
      console.log(
        `[BG Client OCR Result] Found matching Image OCR request for ${requestId}. Resolving.`
      );
      imageResolve(result);
      pendingClientImageOcrRequests.delete(requestId);
      sendResponse({ status: "success", message: "Image OCR result processed by background." });
      return true;
    }

    logErrorToSentry(
      `[BG Client OCR Result] Received CLIENT_PDF_OCR_RESULT for unknown or timed out requestId: ${requestId}`,
      "warning"
    );
    sendResponse({ status: "error", message: "Unknown or timed out OCR requestId." });
    return true;
  }

  return false; // Default to false if not returning true for async responses
});

async function handlePropertyDataExtraction(
  propertyData: ExtractedPropertyScrapingData,
  sendResponseToContentScript: (response: any) => void,
  tabId?: number
) {
  // 1. ERROR CHECKS
  const propertyId = propertyData.propertyId;
  if (!propertyId) {
    logErrorToSentry("[handlePropertyDataExtraction] Missing propertyId. Aborting.", "warning");
    sendResponseToContentScript({ status: "error", message: "Missing propertyId." });
    return;
  }

  // 2. CHECK IF PROCESSING IS ALREADY IN PROGRESS
  if (processingPropertyIds.has(propertyId)) {
    console.log(
      `[BG Process] handlePropertyDataExtraction already running for property ID: ${propertyId}. Aborting duplicate run.`
    );
    sendResponseToContentScript({
      status: "skipped",
      message: "Processing already in progress for this property.",
    });
    return;
  }
  processingPropertyIds.add(propertyId);

  console.log(
    `[BG Process] Starting handlePropertyDataExtraction for property ID: ${propertyId}, Tab ID: ${tabId}`,
    {
      propertyData,
    }
  );

  // 3. CACHE CHECK
  try {
    // Ensure tabId is valid before proceeding with operations that require it
    if (typeof tabId !== "number") {
      logErrorToSentry(
        "[handlePropertyDataExtraction] Invalid or missing tabId. Aborting further processing that relies on tabId.",
        "error"
      );
      sendResponseToContentScript({
        status: "error",
        message: "Background processing failed due to invalid tabId.",
      });
      processingPropertyIds.delete(propertyId); // Clean up
      return;
    }

    // --- Load authoritative data from storage ---
    let authoritativePropertyData: ExtractedPropertyScrapingData | null = null;
    const cacheKey = `propertyData-${propertyId}`;
    try {
      const cached = await chrome.storage.local.get(cacheKey);
      if (cached[cacheKey]) {
        authoritativePropertyData = cached[cacheKey] as ExtractedPropertyScrapingData;
        console.log(`[BG Cache] Loaded data from cache for property ${propertyId}.`);
      } else {
        console.log(`[BG Cache] No data in cache for property ${propertyId}.`);
      }
    } catch (error) {
      logErrorToSentry(
        `[BG Cache] Error loading data from cache for property ${propertyId}: ${error instanceof Error ? error.message : String(error)}`,
        "warning"
      );
    }

    // --- Merge Fresh and Authoritative Data ---
    let currentPropertyData: ExtractedPropertyScrapingData;
    if (authoritativePropertyData) {
      currentPropertyData = {
        ...authoritativePropertyData, // Start with cached data as the base
        ...propertyData, // Override with fresh non-null/undefined values from content script
        address: {
          ...(authoritativePropertyData.address || {}),
          ...(propertyData.address || {}),
          // Ensure critical fields like postcode from fresh data are preserved if authoritative is missing them
          postcode: propertyData.address?.postcode || authoritativePropertyData.address?.postcode,
          displayAddress:
            propertyData.address?.displayAddress ||
            authoritativePropertyData.address?.displayAddress,
        },
        epc: {
          ...(authoritativePropertyData.epc || {}),
          ...(propertyData.epc || {}),
          // Ensure URL from fresh scrape is prioritized if available
          url: propertyData.epc?.url || authoritativePropertyData.epc?.url,
        },
      };
      console.log(`[BG Merge] Merged cached and fresh data for property ${propertyId}.`);
    } else {
      currentPropertyData = propertyData; // No cache, use fresh data
      console.log(`[BG Merge] No cached data. Using fresh data for property ${propertyId}.`);
    }

    // Initialize confidence flags (will be updated by subsequent steps)
    let addressIsNowHighlyConfident =
      currentPropertyData.address?.addressConfidence === ConfidenceLevels.HIGH ||
      currentPropertyData.address?.addressConfidence ===
        ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED ||
      currentPropertyData.address?.addressConfidence === ConfidenceLevels.USER_PROVIDED;
    let epcIsNowHighlyConfident =
      currentPropertyData.epc?.confidence === ConfidenceLevels.HIGH ||
      currentPropertyData.epc?.confidence === ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED ||
      currentPropertyData.epc?.confidence === ConfidenceLevels.USER_PROVIDED;

    // 4. --- HOUSE PRICES PAGE ADDRESS LOOKUP ---
    // Fetches the Rightmove sold house prices page,
    // and attempts to find a matching property based on sale history.
    if (currentPropertyData.addressLookupInputs && !addressIsNowHighlyConfident) {
      console.log(
        `[BG Address Lookup] Address confidence is not high (${currentPropertyData.address.addressConfidence}). Attempting House Prices Page lookup for ${propertyId}.`
      );
      try {
        const housePricesAddressString = await lookupAddressFromHousePricesPage(
          currentPropertyData.addressLookupInputs
        );

        if (housePricesAddressString) {
          console.log(
            `[BG Address Lookup] House Prices Page lookup successful for ${propertyId}. Matched Address: ${housePricesAddressString}`
          );
          currentPropertyData.address = {
            ...currentPropertyData.address,
            displayAddress: housePricesAddressString,
            addressConfidence: ConfidenceLevels.HIGH,
            source: AddressSourceType.HOUSE_PRICES_PAGE_MATCH,
          };
          addressIsNowHighlyConfident =
            currentPropertyData.address.addressConfidence === ConfidenceLevels.HIGH ||
            currentPropertyData.address.addressConfidence ===
              ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED ||
            currentPropertyData.address.addressConfidence === ConfidenceLevels.USER_PROVIDED;
        } else {
          console.log(
            `[BG Address Lookup] House Prices Page lookup did not find a match for ${propertyId}.`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logErrorToSentry(
          `[BG Address Lookup] Error during House Prices Page lookup for ${propertyId}: ${errorMsg}`,
          "error"
        );
      }
    } else {
      if (addressIsNowHighlyConfident) {
        console.log(
          `[BG Address Lookup] Skipping House Prices Page lookup for ${propertyId} as address confidence is already high (${currentPropertyData.address.addressConfidence}).`
        );
      }
      if (!currentPropertyData.addressLookupInputs) {
        console.log(
          `[BG Address Lookup] Skipping House Prices Page lookup for ${propertyId} as addressLookupInputs are missing.`
        );
      }
    }

    // 5. --- GOV.UK EPC Validation Logic ---
    // Attempts to validate the EPC rating using the GOV.UK EPC register online web page.
    // It uses the address we may have found on the sold house prices page for more accuracy,
    // or alternatively, just returns the list of plausible addresses for the postcode and their epc ratings. The UI will then filter based on an confidence medium match (where we have tried to extract EPC from EPC image or pdf).
    // It may also find the property address from the EPC register if the address is not found on the sold house prices page.
    if (
      currentPropertyData.address &&
      currentPropertyData.address.postcode &&
      currentPropertyData.epc.source !== EpcDataSourceType.GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS &&
      currentPropertyData.epc.confidence !== ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED
    ) {
      console.log(
        `[BG EPC Validation] Attempting GOV.UK EPC validation for ${propertyId} (Postcode: ${currentPropertyData.address.postcode}).`
      );
      try {
        const postcode = currentPropertyData.address.postcode;
        const cachedEPCs = govEpcPostcodeCache.get(postcode);
        let govEPCs: GovEpcCertificate[] | null = cachedEPCs || null;

        if (cachedEPCs === undefined) {
          // Check for undefined to distinguish from null (cache hit, no certs)
          govEPCs = await fetchGovEpcCertificatesByPostcode(postcode);
          govEpcPostcodeCache.set(postcode, govEPCs);
        } else {
          console.log("[background.ts] Using cached GOV EPC certificates for postcode:", postcode);
        }

        if (govEPCs && govEPCs.length > 0) {
          // --- Attempt to find a definitive EPC based on a strong address match first ---\
          // If we have high confidence in the property's address, and we can find a single,
          // strong match in the GOV.UK data for that address, we will use the EPC details
          // from that GOV.UK record, overriding any EPC info from the listing.
          let definitiveGovEpcMatchFound = false;
          if (
            currentPropertyData.address?.displayAddress &&
            (currentPropertyData.address.addressConfidence === ConfidenceLevels.HIGH ||
              currentPropertyData.address.addressConfidence ===
                ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED ||
              currentPropertyData.address.addressConfidence === ConfidenceLevels.USER_PROVIDED)
          ) {
            const bestAddressMatchCert = findBestAddressMatchInGovCertificates(
              govEPCs,
              currentPropertyData.address.displayAddress
            );

            if (bestAddressMatchCert) {
              console.log(
                `[BG EPC Validation] Found definitive GOV.UK EPC record for ${propertyId} based on strong address match:`,
                bestAddressMatchCert.retrievedRating,
                "Certificate:",
                bestAddressMatchCert.certificateUrl
              );
              currentPropertyData.epc = {
                ...currentPropertyData.epc,
                value: bestAddressMatchCert.retrievedRating,
                validUntil: bestAddressMatchCert.validUntil,
                certificateUrl: bestAddressMatchCert.certificateUrl,
                isExpired: bestAddressMatchCert.isExpired,
                source: EpcDataSourceType.GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS,
                confidence: ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED,
              };
              epcIsNowHighlyConfident = true;
              definitiveGovEpcMatchFound = true;
            }
          }

          // --- If no definitive override, proceed with existing plausible/best match logic ---\
          if (!definitiveGovEpcMatchFound) {
            const plausibleMatches = getPlausibleGovEpcMatches(govEPCs, currentPropertyData);

            if (plausibleMatches.length > 0) {
              currentPropertyData.address.govEpcRegisterSuggestions = plausibleMatches;
              // Existing logic: findBestGovEpcMatch tries to validate currentPropertyData.epc.value
              const bestMatch = findBestGovEpcMatch(plausibleMatches, currentPropertyData);

              if (bestMatch && bestMatch.retrievedAddress) {
                // This path is taken if findBestGovEpcMatch found a good candidate,
                // which implies the EPC from the listing was consistent with a gov record
                // or the address match was strong enough to confirm the listing's EPC.
                currentPropertyData.address = {
                  ...currentPropertyData.address,
                  displayAddress: bestMatch.retrievedAddress,
                  addressConfidence: ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED,
                  source: AddressSourceType.GOV_FIND_EPC_SERVICE_CONFIRMED,
                };
                addressIsNowHighlyConfident = true;

                currentPropertyData.epc = {
                  ...currentPropertyData.epc,
                  value: bestMatch.retrievedRating,
                  validUntil: bestMatch.validUntil,
                  certificateUrl: bestMatch.certificateUrl,
                  isExpired: bestMatch.isExpired,
                  source: EpcDataSourceType.GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS,
                  confidence: ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED,
                };
                epcIsNowHighlyConfident = true;
                console.log(
                  `[BG EPC Validation] Confirmed EPC for ${propertyId} via findBestGovEpcMatch:`,
                  currentPropertyData.epc.value
                );
              } else {
                // No single "best" match according to findBestGovEpcMatch (e.g., listing EPC differs from GOV EPC for matched address)
                console.log(
                  `[BG EPC Validation] Plausible GOV matches found for ${propertyId} but no single best match via findBestGovEpcMatch. Count: ${plausibleMatches.length}`
                );
                // Set source and confidence to reflect that GOV service was checked but didn't yield a confident *validation* of the listing's EPC.
                currentPropertyData.epc.source =
                  EpcDataSourceType.GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS;
                currentPropertyData.epc.confidence = ConfidenceLevels.NONE; // Confidence in the *listing's EPC* is None after this check
              }
            } else {
              // No plausible matches found by getPlausibleGovEpcMatches
              console.log(
                `[BG EPC Validation] No plausible EPC matches found for ${propertyId} via getPlausibleGovEpcMatches.`
              );
              currentPropertyData.epc.source =
                EpcDataSourceType.GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS;
              currentPropertyData.epc.confidence = ConfidenceLevels.NONE;
            }
          }
        } else {
          console.log(
            `[BG EPC Validation] No EPC certificates found for postcode ${currentPropertyData.address.postcode} (property ${propertyId}).`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("[background.ts] Error during GOV.UK EPC validation:", errorMsg);
        logErrorToSentry(error, "error");
      }
    }

    // 6. --- IMAGE EPC URL PROCESSING ---
    // (FOR IMG OCR IF NEEDED & FOR DISPLAYING EPC IMAGE IN CHECKLIST)
    // Fetch happens in background not ui to avoid CORS issues.
    const epcUrlAfterImageUrlConversion = await convertEpcUrlToDataUrlIfHttp(
      currentPropertyData.epc.url,
      currentPropertyData.propertyId
    );

    if (
      epcUrlAfterImageUrlConversion &&
      epcUrlAfterImageUrlConversion !== currentPropertyData.epc.url
    ) {
      const updatedEpc = {
        ...currentPropertyData.epc,
        url: epcUrlAfterImageUrlConversion,
      };
      currentPropertyData = {
        ...currentPropertyData,
        epc: updatedEpc,
      };
    }

    // 7. --- IMAGE EPC OCR LOGIC ---
    // Attempt if EPC is not already highly confident on EPC and an image EPC URL exists (not PDF)
    // The content script should have populated propertyData.epc.url if an EPC image was found on the page.
    const epcConfidenceForImageOcr = currentPropertyData.epc.confidence;

    if (
      epcConfidenceForImageOcr !== ConfidenceLevels.HIGH &&
      epcConfidenceForImageOcr !== ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED &&
      epcUrlAfterImageUrlConversion &&
      typeof tabId === "number"
    ) {
      console.log(
        `[BG Image OCR] EPC confidence is ${epcConfidenceForImageOcr}. Attempting Image OCR for property ${propertyId} using URL: ${epcUrlAfterImageUrlConversion}`
      );
      const requestId = `imageOcr-${propertyId}-${Date.now()}`;
      try {
        const imageOcrPromise = new Promise<EpcProcessorResult>((resolve, reject) => {
          pendingClientImageOcrRequests.set(requestId, resolve);
          // Set a timeout for the OCR request
          setTimeout(() => {
            if (pendingClientImageOcrRequests.has(requestId)) {
              pendingClientImageOcrRequests.delete(requestId);
              reject(new Error(`Image OCR request ${requestId} timed out after 30 seconds`));
            }
          }, 30000); // 30 seconds timeout
        });

        chrome.tabs.sendMessage(tabId, {
          action: ActionEvents.BACKGROUND_REQUESTS_CLIENT_IMAGE_OCR,
          payload: {
            fileUrl: epcUrlAfterImageUrlConversion,
            requestId,
          },
        });

        const ocrImageResult = await imageOcrPromise;
        console.log(`[BG Image OCR] Received result for ${requestId}:`, ocrImageResult);

        if (
          ocrImageResult &&
          ocrImageResult.status === DataStatus.FOUND_POSITIVE &&
          ocrImageResult.value
        ) {
          currentPropertyData.epc = {
            ...currentPropertyData.epc,
            value: ocrImageResult.value, // Use .value for rating
            automatedProcessingResult: ocrImageResult.automatedProcessingResult, // Assign nested result
            source: EpcDataSourceType.IMAGE,
            confidence: ocrImageResult.confidence || ConfidenceLevels.MEDIUM, // Use .confidence
            url: ocrImageResult.url,
            error: ocrImageResult.error || null, // If ocrImageResult itself has an error string
          };
          console.log(
            `[BG Image OCR] Successfully updated EPC from Image OCR for ${propertyId}. New rating: ${currentPropertyData.epc.value}`
          );
          if (
            currentPropertyData.epc.confidence === ConfidenceLevels.HIGH ||
            currentPropertyData.epc.confidence === ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED
          ) {
            epcIsNowHighlyConfident = true;
          }
        } else if (ocrImageResult && ocrImageResult.error) {
          // Case: OCR process completed but returned a structured result indicating an error.
          const errorMessage = String(ocrImageResult.error);
          console.warn(
            `[BG Image OCR] Image OCR for ${propertyId} resulted in an error: ${errorMessage}`
          );
          currentPropertyData.epc = {
            ...currentPropertyData.epc,
            value: null,
            confidence: ConfidenceLevels.NONE,
            source: EpcDataSourceType.IMAGE, // Still mark as IMAGE attempt
            error: errorMessage,
            automatedProcessingResult: ocrImageResult.automatedProcessingResult || null,
          };
        } else {
          // Case: OCR process completed but result was not positive or had no value, and no explicit error string in ocrImageResult.error
          // This might indicate an inconclusive OCR.
          const inconclusiveError = "Image OCR was inconclusive or did not yield a value.";
          console.warn(`[BG Image OCR] ${inconclusiveError} for ${propertyId}`);
          currentPropertyData.epc = {
            ...currentPropertyData.epc,
            value: null,
            confidence: ConfidenceLevels.NONE,
            source: EpcDataSourceType.IMAGE,
            error: ocrImageResult?.error || inconclusiveError, // Use error from result if present, else generic
            automatedProcessingResult: ocrImageResult?.automatedProcessingResult || null,
          };
        }
      } catch (error) {
        // Case: Promise rejected (e.g., timeout, sendMessage error, unhandled exception in content script promise chain before returning EpcProcessorResult)
        const errorMsg = error instanceof Error ? error.message : String(error);
        logErrorToSentry(
          `[BG Image OCR] Critical error during Image OCR promise for ${propertyId}: ${errorMsg}`,
          "error"
        );
        currentPropertyData.epc = {
          ...currentPropertyData.epc,
          value: null,
          confidence: ConfidenceLevels.NONE,
          source: EpcDataSourceType.IMAGE, // Still mark as IMAGE attempt
          error: `Image OCR process failed: ${errorMsg}`,
          automatedProcessingResult: null,
        };
      }
    } else {
      if (
        epcConfidenceForImageOcr === ConfidenceLevels.HIGH ||
        epcConfidenceForImageOcr === ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED
      ) {
        console.log(
          `[BG Image OCR] Skipping Image OCR for ${propertyId} as EPC confidence is already ${epcConfidenceForImageOcr}.`
        );
      }
      if (!epcUrlAfterImageUrlConversion) {
        console.log(
          `[BG Image OCR] Skipping Image OCR for ${propertyId} as no relevant EPC image URL was provided. Initial URL: ${propertyData.epc?.url}`
        );
      }
    }

    // 8. --- PDF OCR LOGIC ---
    // Attempt if EPC is not already highly confident on EPC and a PDF EPC URL exists
    // The content script should have populated propertyData.epc.url if an EPC PDF was found on the page.
    const epcConfidenceForPdfOcr = currentPropertyData.epc.confidence;
    const pdfUrlForOcr =
      typeof propertyData.epc?.url === "string" &&
      propertyData.epc.url.toLowerCase().endsWith(".pdf")
        ? propertyData.epc.url
        : null;

    if (
      epcConfidenceForPdfOcr !== ConfidenceLevels.HIGH &&
      epcConfidenceForPdfOcr !== ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED &&
      !epcIsNowHighlyConfident && // Added check, if Image OCR made it highly confident, skip PDF
      pdfUrlForOcr &&
      typeof tabId === "number"
    ) {
      console.log(
        `[BG PDF OCR] EPC confidence is ${epcConfidenceForPdfOcr}. Attempting PDF OCR for property ${propertyId} using URL: ${pdfUrlForOcr}`
      );
      const requestId = `pdfOcr-${propertyId}-${Date.now()}`;
      try {
        const pdfOcrPromise = new Promise<EpcProcessorResult>((resolve, reject) => {
          pendingClientPdfOcrRequests.set(requestId, resolve);
          setTimeout(() => {
            if (pendingClientPdfOcrRequests.has(requestId)) {
              pendingClientPdfOcrRequests.delete(requestId);
              reject(new Error(`PDF OCR request ${requestId} timed out after 30 seconds`));
            }
          }, 30000); // 30 seconds timeout
        });

        chrome.tabs.sendMessage(tabId, {
          action: ActionEvents.BACKGROUND_REQUESTS_CLIENT_PDF_OCR,
          payload: {
            fileUrl: pdfUrlForOcr,
            requestId,
          },
        });

        const ocrPdfResult = await pdfOcrPromise;
        console.log(`[BG PDF OCR] Received result for ${requestId}:`, ocrPdfResult);

        if (
          ocrPdfResult &&
          ocrPdfResult.status === DataStatus.FOUND_POSITIVE &&
          ocrPdfResult.value
        ) {
          currentPropertyData.epc = {
            ...currentPropertyData.epc,
            value: ocrPdfResult.value,
            automatedProcessingResult: ocrPdfResult.automatedProcessingResult,
            source: EpcDataSourceType.PDF,
            confidence: ocrPdfResult.confidence || ConfidenceLevels.MEDIUM,
            url: ocrPdfResult.url, // Keep the original PDF URL or the one from result if different
            error: ocrPdfResult.error || null,
          };
          console.log(
            `[BG PDF OCR] Successfully updated EPC from PDF OCR for ${propertyId}. New rating: ${currentPropertyData.epc.value}`
          );
          if (
            currentPropertyData.epc.confidence === ConfidenceLevels.HIGH ||
            currentPropertyData.epc.confidence === ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED
          ) {
            epcIsNowHighlyConfident = true; // Update master flag
          }
        } else if (ocrPdfResult && ocrPdfResult.error) {
          const errorMessage = String(ocrPdfResult.error);
          console.warn(
            `[BG PDF OCR] PDF OCR for ${propertyId} resulted in an error: ${errorMessage}`
          );
          currentPropertyData.epc = {
            ...currentPropertyData.epc,
            value: null,
            confidence: ConfidenceLevels.NONE,
            source: EpcDataSourceType.PDF,
            error: errorMessage,
            automatedProcessingResult: ocrPdfResult.automatedProcessingResult || null,
          };
        } else {
          const inconclusiveError = "PDF OCR was inconclusive or did not yield a value.";
          console.warn(`[BG PDF OCR] ${inconclusiveError} for ${propertyId}`);
          currentPropertyData.epc = {
            ...currentPropertyData.epc,
            value: null,
            confidence: ConfidenceLevels.NONE,
            source: EpcDataSourceType.PDF,
            error: ocrPdfResult?.error || inconclusiveError,
            automatedProcessingResult: ocrPdfResult?.automatedProcessingResult || null,
          };
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logErrorToSentry(
          `[BG PDF OCR] Critical error during PDF OCR promise for ${propertyId}: ${errorMsg}`,
          "error"
        );
        currentPropertyData.epc = {
          ...currentPropertyData.epc,
          value: null,
          confidence: ConfidenceLevels.NONE,
          source: EpcDataSourceType.PDF,
          error: `PDF OCR process failed: ${errorMsg}`,
          automatedProcessingResult: null,
        };
      }
    } else {
      if (
        epcIsNowHighlyConfident ||
        epcConfidenceForPdfOcr === ConfidenceLevels.HIGH ||
        epcConfidenceForPdfOcr === ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED
      ) {
        console.log(
          `[BG PDF OCR] Skipping PDF OCR for ${propertyId} as EPC confidence is already high (${currentPropertyData.epc.confidence}).`
        );
      }
      if (!pdfUrlForOcr) {
        console.log(
          `[BG PDF OCR] Skipping PDF OCR for ${propertyId} as no relevant PDF URL was provided. Initial URL: ${propertyData.epc?.url}`
        );
      }
    }
    // --- End of PDF OCR Logic ---
    // 9. --- RE-EVALUATION OF GOV SUGGESTIONS & AUTO-CONFIRMATION ---
    // If we have an EPC value from OCR, and the EPC source is either IMAGE or PDF,
    // we can re-evaluate the GOV EPC suggestions to see if we can auto-confirm the EPC value.
    // For example, OCR result is EPC: C and there is only 1 address in list as C - then this can auto-confirm (with medium confidence as OCR so the user double checks)
    const epcValueFromOcr = currentPropertyData.epc.value;
    const epcSourceIsFileBased =
      currentPropertyData.epc.source === EpcDataSourceType.IMAGE ||
      currentPropertyData.epc.source === EpcDataSourceType.PDF;

    if (
      epcValueFromOcr &&
      epcSourceIsFileBased &&
      currentPropertyData.address.govEpcRegisterSuggestions &&
      currentPropertyData.address.govEpcRegisterSuggestions.length > 0 &&
      // Only attempt if we haven't already got a top-tier GOV confirmed EPC
      !(
        currentPropertyData.epc.source ===
          EpcDataSourceType.GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS &&
        currentPropertyData.epc.confidence === ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED
      )
    ) {
      console.log(
        `[BG Re-eval GOV] EPC from file OCR (${epcValueFromOcr}) available. Re-evaluating ${currentPropertyData.address.govEpcRegisterSuggestions.length} GOV EPC suggestions.`
      );

      const MIN_SIMILARITY_FOR_AUTO_CONFIRM = 0.6; // Or use MIN_ADDRESS_SIMILARITY_MEDIUM if imported/available
      let confirmedMatchFromSuggestions: GovEpcValidationMatch | null = null;
      let multipleStrongCandidates = false;

      for (const suggestion of currentPropertyData.address.govEpcRegisterSuggestions) {
        if (
          suggestion.retrievedRating &&
          suggestion.retrievedRating.toUpperCase() === epcValueFromOcr.toUpperCase() &&
          suggestion.addressMatchScore >= MIN_SIMILARITY_FOR_AUTO_CONFIRM
        ) {
          if (confirmedMatchFromSuggestions) {
            // Already found one strong candidate, this means there are multiple
            multipleStrongCandidates = true;
            console.log(
              `[BG Re-eval GOV] Multiple strong candidates found matching OCR EPC ${epcValueFromOcr}. Cannot auto-confirm.`
            );
            break; // Stop checking if multiple are found
          } else {
            confirmedMatchFromSuggestions = suggestion;
          }
        }
      }

      if (confirmedMatchFromSuggestions && !multipleStrongCandidates) {
        console.log(
          `[BG Re-eval GOV] Unique strong match found with OCR EPC. Auto-confirming: Address: ${confirmedMatchFromSuggestions.retrievedAddress}, EPC: ${confirmedMatchFromSuggestions.retrievedRating}`
        );
        // ADDRESS
        currentPropertyData.address = {
          ...currentPropertyData.address,
          displayAddress: confirmedMatchFromSuggestions.retrievedAddress,
          addressConfidence: ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED,
          source: AddressSourceType.GOV_FIND_EPC_SERVICE_CONFIRMED,
          govEpcRegisterSuggestions: null, // Clear suggestions as we have a confirmed one
        };
        addressIsNowHighlyConfident = true;

        // EPC
        currentPropertyData.epc = {
          ...currentPropertyData.epc,
          value: confirmedMatchFromSuggestions.retrievedRating, // Should match epcValueFromOcr
          validUntil: confirmedMatchFromSuggestions.validUntil,
          source: EpcDataSourceType.GOV_EPC_SERVICE_AND_OCR_FILE_EPC_MATCH, // New combined source
          confidence: ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED, // High confidence due to multi-source agreement
        };
        epcIsNowHighlyConfident = true;
      } else if (!multipleStrongCandidates) {
        console.log(
          `[BG Re-eval GOV] No unique strong candidate found among GOV suggestions matching OCR EPC ${epcValueFromOcr}. Suggestions remain.`
        );
      }
      // If multipleStrongCandidates is true, we logged it and suggestions remain as they are.
    }

    // 10. Send PROPERTY_PAGE_OPENED to UI only after all initial data processing
    // also upate the cache with the latest processed data
    console.log("[BG Finalize] Finalizing property data processing. Caching and notifying UI.", {
      propertyId,
      finalAddressConfidence: currentPropertyData.address.addressConfidence,
      finalEpcConfidence: currentPropertyData.epc.confidence,
      finalEpcSource: currentPropertyData.epc.source,
    });

    // Update cache with the latest processed data
    try {
      await chrome.storage.local.set({ [cacheKey]: currentPropertyData });
      console.log(
        `[BG Cache] Successfully saved updated data to cache for property ${propertyId}.`
      );
    } catch (error) {
      logErrorToSentry(
        `[BG Cache] Error saving data to cache for property ${propertyId}: ${error instanceof Error ? error.message : String(error)}`,
        "warning"
      );
    }

    // Notify the UI (Side Panel) that property data is ready/updated
    chrome.runtime.sendMessage(
      {
        action: ActionEvents.PROPERTY_PAGE_OPENED,
        data: currentPropertyData,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          logErrorToSentry(
            `[BG Notify] Error sending PROPERTY_PAGE_OPENED to UI: ${chrome.runtime.lastError.message}`,
            "warning"
          );
        }
      }
    );

    sendResponseToContentScript({ status: "Property data processing complete in background." });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logErrorToSentry(error, "error");
    console.error(
      `[BG Process] Critical error in handlePropertyDataExtraction for propertyId ${propertyId}: ${errorMsg}`,
      { errorContext: error }
    );
    sendResponseToContentScript({
      status: "error",
      message: `Critical background error: ${errorMsg}`,
    });
  } finally {
    if (propertyId) {
      processingPropertyIds.delete(propertyId); // Ensure cleanup
      console.log(
        `[BG Process] Finished handlePropertyDataExtraction for property ID: ${propertyId}. Released lock.`
      );
    }
  }
}
