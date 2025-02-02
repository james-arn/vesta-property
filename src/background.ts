import { ActionEvents } from "./constants/actionEvents";
import {
  MessageRequest,
  NavigatedUrlOrTabChangedOrExtensionOpenedMessage,
  ResponseType,
  ShowWarningMessage,
  UpdatePropertyDataMessage,
} from "./types/messages";

console.log("[background.ts] Background script loaded");
// Background.ts is the central hub
// Listens for messages from the sidebar or content script.
// Sends commands to the content script to scrape data.
// Relays data between the content script and sidebar.

function sendWarningMessage(logMessage: string) {
  console.warn(logMessage);
  const warningMessage: ShowWarningMessage = {
    action: ActionEvents.SHOW_WARNING,
    data: "Please open a property page on rightmove.co.uk.",
  };
  chrome.runtime.sendMessage<ShowWarningMessage, ResponseType>(
    warningMessage,
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[background.ts] Error sending warning message:",
          chrome.runtime.lastError
        );
      } else {
        console.log(
          "[background.ts] Warning message sent successfully:",
          response
        );
      }
    }
  );
}

// Function to update the stored URL and send a message
function handleInitialLoadOrTabChange() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0 || !tabs[0].url) {
      console.warn("No active tab found or tab has no URL.");
      return;
    }

    const currentUrl = tabs[0].url;
    const tabId = tabs[0]?.id;

    if (typeof tabId !== "number") {
      console.warn("Tab has no valid ID.");
      return;
    }

    if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("about:")) {
      sendWarningMessage(
        "Internal Chrome page detected. Sending warning directly."
      );
      return;
    }

    const message: NavigatedUrlOrTabChangedOrExtensionOpenedMessage = {
      action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
      data: currentUrl,
    };
    console.log("[background.ts] Sending message to tab:", tabId, message);
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[background.ts] Error sending message:",
          chrome.runtime.lastError
        );
        if (
          chrome.runtime.lastError?.message?.includes(
            "Could not establish connection"
          )
        ) {
          sendWarningMessage(
            "Content script not loaded. Sending warning directly."
          );
        }
      } else {
        console.log("[background.ts] Message sent successfully:", response);
      }
    });
  });
}

// Tab activation changes
chrome.tabs.onActivated.addListener(handleInitialLoadOrTabChange);

// Tab updates (e.g., when the URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    handleInitialLoadOrTabChange();
  }
});

// Tab Creation
chrome.tabs.onCreated.addListener((tab) => {
  console.log("[background.ts] New tab created:", tab);
  // Handle initial load or tab change for the new tab
  handleInitialLoadOrTabChange();
});

// Set panel behavior and update URL when the panel is opened
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

function handleToContentScriptFromUIMessage(request: MessageRequest) {
  const { action, data } = request;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0 || !tabs[0].id) {
      console.warn("background.ts: No active tab found.");
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
  });
}

function handleToUIFromContentScriptMessage(
  request: MessageRequest,
  sendResponse: (response: ResponseType) => void
) {
  if (request.action === ActionEvents.SIDE_PANEL_OPENED) {
    console.log("[background.ts] Side panel opened");
    handleInitialLoadOrTabChange();
    sendResponse({ status: "Handled side panel opened" });
  }

  if (request.action === ActionEvents.UPDATE_PROPERTY_DATA) {
    console.log("[background.ts] Property Data:", request.data);
    chrome.runtime.sendMessage<UpdatePropertyDataMessage, ResponseType>(
      request as UpdatePropertyDataMessage,
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[background.ts] Error forwarding message:",
            chrome.runtime.lastError
          );
        } else {
          console.log("[background.ts] Message forwarded to UI:", request);
          console.log("[background.ts] Response:", response);
        }
      }
    );
  }

  if (request.action === ActionEvents.SHOW_WARNING) {
    console.log("[background.ts] Warning Message:", request.data);
    chrome.runtime.sendMessage<ShowWarningMessage, ResponseType>(
      request as ShowWarningMessage,
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "[background.ts] Error forwarding message:",
            chrome.runtime.lastError
          );
        } else {
          console.log("[background.ts] Message forwarded to UI:", request);
        }
      }
    );
  }
}

// Listen for messages from the content script and store data.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Messages for the UI
  if (
    request.action === ActionEvents.SIDE_PANEL_OPENED ||
    request.action === ActionEvents.UPDATE_PROPERTY_DATA ||
    request.action === ActionEvents.SHOW_WARNING
  ) {
    handleToUIFromContentScriptMessage(request, sendResponse);
  }

  // Messages for the Content Script
  if (
    request.action === ActionEvents.FILL_RIGHTMOVE_CONTACT_FORM ||
    request.action === ActionEvents.NAVIGATE_BACK_TO_PROPERTY_LISTING
  ) {
    handleToContentScriptFromUIMessage(request);
  }

  // Listen for form submission messages from the content script
  if (request.action === ActionEvents.AGENT_CONTACT_FORM_SUBMITTED) {
    console.log("[background.ts] Form submitted message received");
    // Forward the message to the React app
    chrome.runtime.sendMessage({
      action: ActionEvents.AGENT_CONTACT_FORM_SUBMITTED,
    });
  }
});

// Listen for tab switches
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Get the active tab's URL
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      // Send the URL to the sidebar
      chrome.runtime.sendMessage<
        NavigatedUrlOrTabChangedOrExtensionOpenedMessage,
        ResponseType
      >({
        action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
        data: tab.url,
      });
    }
  });
});

// Optionally, listen for tab updates (e.g., when the page reloads or URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    chrome.runtime.sendMessage<
      NavigatedUrlOrTabChangedOrExtensionOpenedMessage,
      ResponseType
    >({
      action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
      data: tab.url ?? "",
    });
  }
});
