import { clickBroadbandChecker } from "@/contentScript/utils/propertyScrapeHelpers";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { ActionEvents } from "../../constants/actionEvents";
import { extractPropertyDataFromDOM } from "../utils/propertyDataExtractor";

// Sets up event listeners for the content script
export function setupContentScriptEventListeners() {
  let pageModel: RightmovePageModelType | null = null;

  window.addEventListener("message", (event: any) => {
    if (event.source !== window || event.data.type !== ActionEvents.PAGE_MODEL_AVAILABLE) {
      return;
    }
    clickBroadbandChecker();
    pageModel = event.data.pageModel;
    console.log("Extracted PAGE_MODEL:", pageModel);
  });

  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log("Content Script: Received message:", request);
    if (request.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
      const currentUrl = request.data;
      console.log("Content Script: Current URL:", currentUrl);
      if (currentUrl.startsWith("https://www.rightmove.co.uk/property-for-sale/contactBranch")) {
        // No action needed, as user needs to refer to the sidebar.
        sendResponse({ status: "ok", message: "No action taken for contactBranch URL" });
      } else if (currentUrl.includes("rightmove.co.uk/properties/")) {
        const propertyData = await extractPropertyDataFromDOM(pageModel);
        console.log("Content Script: Extracted property data:", propertyData);

        chrome.runtime.sendMessage({
          action: ActionEvents.UPDATE_PROPERTY_DATA,
          data: propertyData,
        });
        sendResponse({ status: "ok", message: "tab changed/extension opened, sent property data" });
      } else {
        console.log(
          "Content Script: URL does not match the desired pattern. Sending warning message."
        );
        chrome.runtime.sendMessage({
          action: ActionEvents.SHOW_WARNING,
          data: "Please open a property page on rightmove.co.uk.",
        });
        sendResponse({ status: "error", message: "URL not matching pattern" });
      }
      return true;
    }
  });
}
