import { AddressLookupResultMessage } from "@/types/messages";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { ActionEvents } from "../../constants/actionEvents";
import {
  handleAddressLookupResult,
  handlePageModelAvailable,
  handlePageModelTimeout,
  handleTabOrNavigationUpdate,
} from "../contentScriptHandlers";

// Sets up event listeners for the content script
export function setupContentScriptEventListeners() {
  // Listener for messages from the injected script (injectScript.js)
  window.addEventListener("message", async (event: MessageEvent) => {
    // Log ALL messages from window source to see if injectScript is posting
    // if (event.source === window && event.data?.type) {
    //   console.log(`[CS windowListener] Received message type: ${event.data.type}`, event.data);
    // }

    if (event.source !== window || !event.data) {
      return;
    }

    // Call handlers from the helper module
    if (event.data.type === ActionEvents.PAGE_MODEL_AVAILABLE) {
      // console.log(
      //   "[CS windowListener] PAGE_MODEL_AVAILABLE received, calling handlePageModelAvailable."
      // ); // Log before calling handler
      handlePageModelAvailable(event.data.pageModel as RightmovePageModelType);
    } else if (event.data.type === "pageModelTimeout") {
      handlePageModelTimeout(event.data.url as string);
    }
  });

  // Listener for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // console.log(
    //   "[ContentScript Listener] Received message from background:",
    //   request.action || request.type, // Log type for address lookup
    //   request.data || request.payload // Log payload for address lookup
    // );

    // Call handlers from the helper module
    if (request.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
      handleTabOrNavigationUpdate(request.data as string);
      // No async response needed from this handler normally
      return false;
    }
    // Use request.type for address lookup result
    else if (request.type === ActionEvents.ADDRESS_LOOKUP_RESULT) {
      handleAddressLookupResult((request as AddressLookupResultMessage).payload);
      // Indicate potential async response, although handler might be sync
      sendResponse({ status: "Address lookup result processing attempted." });
      return true;
    }

    // Handle other potential messages if necessary

    // Default: No specific handler matched, no async response
    return false;
  });
}
