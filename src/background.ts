import { ActionEvents } from "./constants/actionEvents";
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

// Function to update the stored URL and send a message
function handleInitialLoadOrTabChange(sendResponse: (response: ResponseType) => void) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0 || !tabs[0].url) {
      logErrorToSentry("No active tab found or tab has no URL.", "warning");
      sendResponse({ status: "No active tab found or tab has no URL" });
      return;
    }

    const currentUrl = tabs[0].url;
    const tabId = tabs[0]?.id;

    if (typeof tabId !== "number") {
      console.warn("Tab has no valid ID.");
      sendResponse({ status: "Tab has no valid ID" });
      return;
    }

    if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("about:")) {
      sendWarningMessage("Internal Chrome page detected. Sending warning directly.");
      sendResponse({ status: "Internal Chrome page detected" });
      return;
    }

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
  });
}

// Tab activation changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleInitialLoadOrTabChange(() => {});
});
// Tab updates (e.g., when the URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    handleInitialLoadOrTabChange((response) => {
      console.log("[background.ts] Tab updated response:", response);
    });
  }
});

// Tab Creation
chrome.tabs.onCreated.addListener((tab) => {
  console.log("[background.ts] New tab created:", tab);
  // Handle initial load or tab change for the new tab
  handleInitialLoadOrTabChange((response) => {
    console.log("[background.ts] New tab response:", response);
  });
});

// Set panel behavior and update URL when the panel is opened
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => logErrorToSentry(error));

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
  if (request.action === ActionEvents.SIDE_PANEL_OPENED) {
    console.log("[background.ts] Side panel opened");
    handleInitialLoadOrTabChange((response) => {
      console.log("[background.ts] Side panel response:", response);
    });
    sendResponse({ status: "Handled side panel opened" });
  }

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
    request.action === ActionEvents.SIDE_PANEL_OPENED ||
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
