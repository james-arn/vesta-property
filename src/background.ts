import {
  AddressLookupPayload,
  lookupAddressFromHousePricesPage,
} from "@/background/addressLookupHelper";
import { exchangeCodeForTokens, storeAuthTokens } from "@/background/authHelpers";
import { fetchGovEpcCertificatesByPostcode } from "./background/govEpcService/govEpcFetcher";
import {
  findBestGovEpcMatch,
  getPlausibleGovEpcMatches,
} from "./background/govEpcService/govEpcMatcher";
import { sendMessageToOffscreenDocument } from "./background/offscreenDocumentHelper";
import { ActionEvents } from "./constants/actionEvents";
import { ENV_CONFIG } from "./constants/environmentConfig";
import { RIGHTMOVE_PROPERTY_PAGE_REGEX } from "./constants/regex";
import { StorageKeys } from "./constants/storage";
import { type EpcProcessorResult } from "./lib/epcProcessing";
import { GovEpcCertificate, GovEpcValidationMatch } from "./types/govEpcCertificate";
import {
  AddressLookupResultMessage,
  NavigatedUrlOrTabChangedOrExtensionOpenedMessage,
  ResponseType,
  ShowWarningMessage,
} from "./types/messages";
import {
  Address,
  ConfidenceLevels,
  DataStatus,
  EpcData,
  EpcDataSourceType,
  ExtractedPropertyScrapingData,
} from "./types/property";
import { ExtractedEpcData as PdfExtractedEpcDataType } from "./utils/pdfProcessingUtils"; // For type casting
import { logErrorToSentry } from "./utils/sentry";

// --- Constants for Offscreen Document ---
const PDF_OCR_OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const PDF_OCR_OFFSCREEN_REASONS: chrome.offscreen.Reason[] = [
  chrome.offscreen.Reason.IFRAME_SCRIPTING,
  chrome.offscreen.Reason.DOM_SCRAPING,
];
const PDF_OCR_OFFSCREEN_JUSTIFICATION =
  "Required for processing PDF EPC documents using an iframe sandbox (via epcProcessing.ts) to extract data in a background context.";
// --- End Constants for Offscreen Document ---

// Session cache for GOV EPC postcode lookups
const govEpcPostcodeCache = new Map<string, GovEpcCertificate[] | null>();

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
      return false;
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

  // Handle Address Lookup Request
  if (message.action === ActionEvents.REQUEST_ADDRESS_LOOKUP) {
    // The message.data should be AddressLookupPayload as per RequestAddressLookupMessage
    // However, RequestAddressLookupMessage itself has `type` and `payload`.
    // So, the actual AddressLookupPayload is message.payload if message is RequestAddressLookupMessage.
    // Let's assume the top-level message has action, and message.data is the payload for that action.
    const payload = message.data as AddressLookupPayload; // If message.data IS the AddressLookupPayload

    // If message is RequestAddressLookupMessage, then it should be:
    // const payload = (message as RequestAddressLookupMessage).payload;
    // Let's stick to the simpler message.data as AddressLookupPayload for now and see if it aligns with how it's dispatched.
    // The linter errors suggest message.data *is* being treated as AddressLookupPayload directly.

    (async () => {
      try {
        // lookupAddressFromHousePricesPage expects an AddressLookupPayload
        const addressDetails = await lookupAddressFromHousePricesPage(payload);

        // Construct the response according to AddressLookupResultMessage
        const responseMessage: AddressLookupResultMessage = {
          type: ActionEvents.ADDRESS_LOOKUP_RESULT, // Correct: use 'type'
          payload: {
            fullAddress: addressDetails || null,
            // propertyId and source are NOT part of AddressLookupResultMessage's defined payload
          },
        };
        chrome.runtime.sendMessage(responseMessage);
        sendResponse({ status: "Address lookup processed" });
      } catch (error) {
        logErrorToSentry(
          // If propertyId was part of the original request for logging, it needs to come from payload if defined there.
          // Since AddressLookupPayload doesn't have propertyId, we can't log it here from payload.
          `Error during address lookup: ${error instanceof Error ? error.message : String(error)}`,
          "error"
        );
        sendResponse({ status: "Error during address lookup", error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.action === ActionEvents.CONTENT_SCRIPT_PROPERTY_DATA_EXTRACTED) {
    // Pass to the async handler function. Return true to indicate async response.
    handlePropertyDataExtraction(message.data as ExtractedPropertyScrapingData, sendResponse);
    return true;
  }

  // If a message is not handled by any of the specific handlers above:
  // console.warn(`[onMessage] Unhandled message action: ${message?.action} from ${senderContext}`);
  // sendResponse({ status: "Action not handled by background script" }); // Optionally respond for unhandled cases
  return false; // Default to false if not returning true for async responses
});

async function getLoginUrl(): Promise<string> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  await chrome.storage.local.set({ [StorageKeys.AUTH_CODE_VERIFIER]: codeVerifier });

  // Use AUTH_COGNITO_DOMAIN for the base URL and ensure /authorize path is appended
  const baseUrl = ENV_CONFIG.AUTH_COGNITO_DOMAIN;
  const authorizeUrl = baseUrl.endsWith("/")
    ? `${baseUrl}oauth2/authorize`
    : `${baseUrl}/oauth2/authorize`;
  // Cognito typically uses /oauth2/authorize, not just /authorize. Confirm if your setup is different.

  const authUrl = new URL(authorizeUrl);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", ENV_CONFIG.AUTH_CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", ENV_CONFIG.REDIRECT_URI);
  authUrl.searchParams.append("code_challenge", codeChallenge);
  authUrl.searchParams.append("code_challenge_method", "S256");
  // authUrl.searchParams.append("audience", ENV_CONFIG.AUDIENCE); // AUDIENCE is not defined in your ENV_CONFIG
  return authUrl.toString();
}

// PKCE HELPER FUNCTIONS
const generateCodeVerifier = (length = 64) => {
  const SPREAD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += SPREAD[Math.floor(Math.random() * SPREAD.length)];
  }
  return token;
};

const generateCodeChallenge = async (verifier: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

// Ensure this function is properly defined if it was missing or causing issues before.
async function handlePropertyDataExtraction(
  propertyData: ExtractedPropertyScrapingData,
  sendResponseToContentScript: (response: any) => void
) {
  let currentPropertyData = { ...propertyData }; // Work with a mutable copy

  console.log(
    `[background.ts] Processing ${ActionEvents.CONTENT_SCRIPT_PROPERTY_DATA_EXTRACTED}:`,
    currentPropertyData
  );

  // Initial cache and UI update with scraped data
  if (currentPropertyData.propertyId) {
    await chrome.storage.local.set({
      [`${StorageKeys.PROPERTY_DATA_CACHE_PREFIX}${currentPropertyData.propertyId}`]:
        currentPropertyData,
    });
  }
  chrome.runtime.sendMessage({
    action: ActionEvents.PROPERTY_PAGE_OPENED,
    data: currentPropertyData,
  });

  // --- GOV.UK EPC Validation Logic ---
  if (
    currentPropertyData.address?.postcode &&
    (currentPropertyData.address.addressConfidence !== ConfidenceLevels.HIGH ||
      currentPropertyData.epc?.confidence !== ConfidenceLevels.HIGH) &&
    currentPropertyData.address.addressConfidence !== ConfidenceLevels.CONFIRMED_BY_GOV_EPC &&
    currentPropertyData.epc?.source !== EpcDataSourceType.GOV_EPC_REGISTER
  ) {
    console.log(
      "[background.ts] Attempting GOV.UK EPC validation for postcode:",
      currentPropertyData.address.postcode
    );
    try {
      const postcode = currentPropertyData.address.postcode;
      const cachedCertificates = govEpcPostcodeCache.get(postcode);
      let govCertificates: GovEpcCertificate[] | null = cachedCertificates || null;

      if (cachedCertificates === undefined) {
        // Check for undefined to distinguish from null (cache hit, no certs)
        govCertificates = await fetchGovEpcCertificatesByPostcode(postcode);
        govEpcPostcodeCache.set(postcode, govCertificates);
      } else {
        console.log("[background.ts] Using cached GOV EPC certificates for postcode:", postcode);
      }

      if (govCertificates && govCertificates.length > 0) {
        const bestMatch: GovEpcValidationMatch | null = findBestGovEpcMatch(
          govCertificates,
          currentPropertyData
        );

        if (bestMatch && bestMatch.overallMatchStrength === "strong") {
          // Corrected to lowercase "strong"
          console.log("[background.ts] Strong GOV.UK EPC match found:", bestMatch);
          currentPropertyData = {
            ...currentPropertyData,
            address: {
              ...currentPropertyData.address,
              displayAddress: bestMatch.retrievedAddress,
              addressConfidence: ConfidenceLevels.CONFIRMED_BY_GOV_EPC,
              govEpcRegisterSuggestions: null,
            } as Address,
            epc: {
              ...currentPropertyData.epc,
              value: bestMatch.retrievedRating,
              confidence: ConfidenceLevels.CONFIRMED_BY_GOV_EPC,
              source: EpcDataSourceType.GOV_EPC_REGISTER,
              url: bestMatch.certificateUrl,
              automatedProcessingResult: {
                currentEpcRating: bestMatch.retrievedRating,
                pdfAddress: bestMatch.retrievedAddress, // This field may not be accurate if source is not PDF
                // Consider naming it 'retrievedOfficialAddress' or similar in a common structure
              },
              error: null,
            } as EpcData,
          };
        } else {
          const plausibleMatches = getPlausibleGovEpcMatches(govCertificates, currentPropertyData);
          console.log("[background.ts] Plausible GOV.UK EPC matches:", plausibleMatches);
          currentPropertyData = {
            ...currentPropertyData,
            address: {
              ...currentPropertyData.address,
              govEpcRegisterSuggestions: plausibleMatches.length > 0 ? plausibleMatches : null,
            } as Address,
          };
        }

        // No storage set or UI message here yet, will be done after PDF attempt
      } else {
        console.log("[background.ts] No GOV.UK EPC certificates found for postcode:", postcode);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[background.ts] Error during GOV.UK EPC validation:", errorMsg);
      logErrorToSentry(
        error instanceof Error ? error : new Error(`GOV.UK EPC validation failed: ${errorMsg}`),
        "error"
      );
    }
  }
  // --- End GOV.UK EPC Validation Logic ---

  // --- PDF OCR Fallback Logic ---
  const { address, epc } = currentPropertyData;
  const isAddressStillUnconfirmed =
    address?.addressConfidence !== ConfidenceLevels.HIGH &&
    address?.addressConfidence !== ConfidenceLevels.CONFIRMED_BY_GOV_EPC;
  const isEpcStillUnconfirmed =
    epc?.confidence !== ConfidenceLevels.HIGH &&
    epc?.confidence !== ConfidenceLevels.CONFIRMED_BY_GOV_EPC;
  const hasPdfUrlForEpc = epc?.url && epc.url.toLowerCase().endsWith(".pdf");
  const isNotAlreadyProcessedPdf = epc?.source !== EpcDataSourceType.PDF;

  if (
    (isAddressStillUnconfirmed || isEpcStillUnconfirmed) &&
    hasPdfUrlForEpc &&
    isNotAlreadyProcessedPdf
  ) {
    console.log(
      "[background.ts] Low confidence after GOV EPC, attempting PDF OCR for EPC URL:",
      epc.url
    );
    try {
      const ocrResult = await sendMessageToOffscreenDocument<EpcProcessorResult>(
        PDF_OCR_OFFSCREEN_DOCUMENT_PATH,
        PDF_OCR_OFFSCREEN_REASONS,
        PDF_OCR_OFFSCREEN_JUSTIFICATION,
        {
          action: ActionEvents.BACKGROUND_REQUEST_PDF_OCR,
          payload: { pdfUrl: epc.url },
        }
      );

      console.log(
        "[background.ts] PDF OCR Result from Offscreen:",
        JSON.stringify(ocrResult, null, 2)
      );

      // Check if OCR was successful (no error string and status indicates success)
      if (ocrResult && !ocrResult.error && ocrResult.status === DataStatus.FOUND_POSITIVE) {
        const ocrProcessedEpcValue = ocrResult.value; // This is the EPC rating (e.g., "C")
        let ocrExtractedAddress: string | null = null;

        if (
          ocrResult.automatedProcessingResult &&
          "fullAddress" in ocrResult.automatedProcessingResult
        ) {
          ocrExtractedAddress = (ocrResult.automatedProcessingResult as PdfExtractedEpcDataType)
            .fullAddress;
        }

        // Update EPC data from PDF if an EPC value was found
        if (ocrProcessedEpcValue) {
          currentPropertyData = {
            ...currentPropertyData,
            epc: {
              ...currentPropertyData.epc,
              value: ocrProcessedEpcValue,
              confidence: ConfidenceLevels.MEDIUM, // EPC from PDF might be medium confidence
              source: EpcDataSourceType.PDF,
              url: ocrResult.url, // The PDF URL itself
              automatedProcessingResult: ocrResult.automatedProcessingResult,
              error: null, // Clear previous errors
            } as EpcData,
          };
        }

        if (
          ocrExtractedAddress &&
          !(
            currentPropertyData.address.addressConfidence === ConfidenceLevels.HIGH ||
            currentPropertyData.address.addressConfidence === ConfidenceLevels.CONFIRMED_BY_GOV_EPC
          )
        ) {
          console.log("[background.ts] Updating address from PDF OCR result:", ocrExtractedAddress);
          currentPropertyData = {
            ...currentPropertyData,
            address: {
              ...currentPropertyData.address,
              displayAddress: ocrExtractedAddress,
              addressConfidence: ConfidenceLevels.MEDIUM, // Address from PDF gets medium confidence
              govEpcRegisterSuggestions: null,
            } as Address,
          };
        }
      } else {
        const errorDetail = ocrResult?.error || `OCR status was ${ocrResult?.status || "unknown"}`;
        console.warn(
          `[background.ts] PDF OCR was attempted but returned an error or non-positive status. Detail: ${errorDetail}. Full OCR Result:`,
          ocrResult
        );
        if (ocrResult?.error) {
          logErrorToSentry(`[background.ts] PDF OCR explicit error: ${ocrResult.error}`, "warning");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logErrorToSentry(
        `[background.ts] Error during PDF OCR offscreen orchestration: ${errorMessage}`,
        "error"
      );
      if (!(error instanceof Error)) {
        console.error("[background.ts] Original non-Error object in PDF OCR catch:", error);
      }
    }
  }
  // --- END OF PDF OCR ATTEMPT ---

  // --- FINAL DATA PROCESSING AND UI UPDATE (MOVED HERE) ---
  // This section now runs regardless of PDF OCR success/failure,
  // ensuring the UI always gets an update with the best data available.
  console.log(
    "[background.ts] Finalizing property data processing. Caching and notifying UI (after all attempts).",
    currentPropertyData
  );
  if (currentPropertyData.propertyId) {
    await chrome.storage.local.set({
      [`${StorageKeys.PROPERTY_DATA_CACHE_PREFIX}${currentPropertyData.propertyId}`]:
        currentPropertyData,
    });
  }
  chrome.runtime.sendMessage({
    action: ActionEvents.PROPERTY_PAGE_OPENED,
    data: currentPropertyData,
  });
  // --- END FINAL DATA PROCESSING AND UI UPDATE (MOVED HERE) ---

  sendResponseToContentScript({ status: "Property data processing complete in background." });
}
