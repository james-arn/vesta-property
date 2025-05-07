import { clickBroadbandChecker } from "@/contentScript/utils/propertyScrapeHelpers";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { ActionEvents } from "../../constants/actionEvents";
import { extractPropertyDataFromDOM } from "../utils/propertyDataExtractor";

// Sets up event listeners for the content script
export function setupContentScriptEventListeners() {
  let pageModel: RightmovePageModelType | null = null;
  let hasProcessedForCurrentNavigation = false;
  let pageModelSourceUrl: string | null = null; // To store the URL when pageModel was received

  async function processPageModelAndSendData(
    model: RightmovePageModelType | null,
    currentUrl: string
  ) {
    if (!model) {
      console.warn(
        "Content Script: processPageModelAndSendData called with null model for URL:",
        currentUrl
      );
      return;
    }

    if (currentUrl.startsWith("https://www.rightmove.co.uk/property-for-sale/contactBranch")) {
      console.log(
        "Content Script: No data extraction action needed for contactBranch URL:",
        currentUrl
      );
      return;
    }
    if (currentUrl.includes("rightmove.co.uk/properties/")) {
      let propertyData; // Declare propertyData outside try
      try {
        propertyData = await extractPropertyDataFromDOM(model);
      } catch (e) {
        console.error("[Content Script] Error during extractPropertyDataFromDOM:", e);
      }

      if (propertyData) {
        console.log(
          "[Content Script] Attempting to send PROPERTY_PAGE_OPENED with data:",
          propertyData
        );
        try {
          chrome.runtime.sendMessage({
            action: ActionEvents.PROPERTY_PAGE_OPENED,
            data: propertyData,
          });
          console.log(
            "[Content Script] Sent PROPERTY_PAGE_OPENED successfully (synchronous part)."
          );
        } catch (e) {
          console.error("[Content Script] Error synchronously sending PROPERTY_PAGE_OPENED:", e);
        }
      } else {
        console.warn(
          "[Content Script] extractPropertyDataFromDOM did not return data or an error occurred. URL:",
          currentUrl
        );
      }
    } else {
      console.log(
        "Content Script: URL does not match property page pattern for data extraction. URL:",
        currentUrl
      );
      // This case is usually handled by injectScript.js timing out and sending pageModelTimeout,
      // which then triggers sendShowWarning.
    }
    hasProcessedForCurrentNavigation = true;
  }

  function sendShowWarning(reasonUrl: string) {
    const messagePayload = {
      action: ActionEvents.SHOW_WARNING,
      data: "Please open a Rightmove property page. (URL: " + reasonUrl + ")",
    };
    console.log(
      `[Content Script] Attempting to send SHOW_WARNING for URL: ${reasonUrl}`,
      messagePayload
    );
    try {
      chrome.runtime.sendMessage(messagePayload);
      console.log("[Content Script] Sent SHOW_WARNING successfully (synchronous part).");
    } catch (e) {
      console.error("[Content Script] Error synchronously sending SHOW_WARNING:", e);
    }
    hasProcessedForCurrentNavigation = true;
  }

  // Listener for messages from the injected script (injectScript.js)
  window.addEventListener("message", async (event: MessageEvent) => {
    if (event.source !== window || !event.data) {
      return;
    }

    if (event.data.type === ActionEvents.PAGE_MODEL_AVAILABLE) {
      console.log(
        `[Content Script] Received PAGE_MODEL_AVAILABLE from injected script at ${new Date().toISOString()} for URL: ${window.location.href}`
      );
      pageModel = event.data.pageModel as RightmovePageModelType;
      pageModelSourceUrl = window.location.href; // Store the URL at which the model was received
      hasProcessedForCurrentNavigation = false; // Reset for new model

      if (window.location.href.includes("rightmove.co.uk/properties/")) {
        try {
          await clickBroadbandChecker();
        } catch (e) {
          console.warn("[Content Script] clickBroadbandChecker failed or timed out:", e);
        }
      }
      await processPageModelAndSendData(pageModel, window.location.href);
    } else if (event.data.type === "pageModelTimeout") {
      // Only send warning if we haven't already processed data for the current navigation focus
      // And if the current page URL matches the URL for which timeout occurred.
      if (!hasProcessedForCurrentNavigation && window.location.href === event.data.url) {
        sendShowWarning(event.data.url);
      }
      pageModel = null; // Clear any stale model
      pageModelSourceUrl = null;
    }
  });

  // Listener for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(
      "Content Script: Received message from background:",
      request.action,
      "for URL:",
      request.data
    );

    if (request.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
      const currentUrlFromBackground = request.data as string;
      // Reset processing flag as this is a new focus/navigation event from background
      hasProcessedForCurrentNavigation = false;

      if (
        pageModel &&
        pageModelSourceUrl === currentUrlFromBackground &&
        !hasProcessedForCurrentNavigation
      ) {
        console.log(
          "Content Script: Page model previously loaded for this exact URL. Re-processing for new tab/URL focus:",
          currentUrlFromBackground
        );
        processPageModelAndSendData(pageModel, currentUrlFromBackground);
      } else if (pageModel && pageModelSourceUrl !== currentUrlFromBackground) {
        console.log(
          "Content Script: Stale pageModel from different URL. Waiting for new PAGE_MODEL_AVAILABLE or pageModelTimeout for:",
          currentUrlFromBackground
        );
        pageModel = null; // Invalidate stale model from a different URL
        pageModelSourceUrl = null;
        // Rely on injectScript.js for this new URL to send pageModelAvailable or pageModelTimeout
      } else if (!pageModel) {
        console.log(
          "Content Script: No pageModel currently available. Waiting for PAGE_MODEL_AVAILABLE or pageModelTimeout from injectScript for URL:",
          currentUrlFromBackground
        );
      }
    }
    return false;
  });
}
