import { clickBroadbandChecker } from "@/contentScript/utils/propertyScrapeHelpers";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { ActionEvents } from "../../constants/actionEvents";
import { PropertyDataList } from "../../types/property";
import { extractPropertyDataFromDOM } from "../utils/propertyDataExtractor";

// Sets up event listeners for the content script
export function setupContentScriptEventListeners() {
  let pageModel: RightmovePageModelType | null = null;

  window.addEventListener("message", (event: any) => {
    if (event.source !== window || event.data.type !== "pageModelAvailable") {
      return;
    }
    clickBroadbandChecker();
    pageModel = event.data.pageModel;
    console.log("Extracted PAGE_MODEL:", pageModel);
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content Script: Received message:", request);
    if (
      request.action ===
      ActionEvents.NAVIGATED_URL_OR_TAB_CHANGED_OR_EXTENSION_OPENED
    ) {
      const currentUrl = request.data;
      console.log("Content Script: Current URL:", currentUrl);
      if (
        currentUrl.startsWith(
          "https://www.rightmove.co.uk/property-for-sale/contactBranch"
        )
      ) {
        // No action needed, as the sidebar can use the step directly
      } else if (currentUrl.includes("rightmove.co.uk/properties/")) {
        const propertyData = extractPropertyDataFromDOM(pageModel);
        console.log("Content Script: Extracted property data:", propertyData);

        chrome.runtime.sendMessage({
          action: ActionEvents.UPDATE_PROPERTY_DATA,
          data: propertyData,
        });
      } else {
        console.log(
          "Content Script: URL does not match the desired pattern. Sending warning message."
        );
        chrome.runtime.sendMessage({
          action: ActionEvents.SHOW_WARNING,
          data: "Please open a property page on rightmove.co.uk.",
        });
      }
    }
    if (request.action === ActionEvents.NAVIGATE_AND_SEND_DATA) {
      const selectedWarningItems: PropertyDataList[] =
        request.data.selectedWarningItems;

      chrome.storage.local.set({ selectedWarningItems }, () => {
        console.log("Selected warning items stored.");

        // Navigate to the new URL
        window.location.href = request.data.url;
      });
    }
  });

  window.addEventListener("load", () => {
    console.log("Content Script: Window loaded");
    chrome.storage.local.get("selectedWarningItems", (result) => {
      const selectedWarningItems: PropertyDataList[] =
        result.selectedWarningItems;
      if (selectedWarningItems) {
        console.log("Retrieved selected warning items:", selectedWarningItems);

        const textArea = document.querySelector(
          "textarea#comments"
        ) as HTMLTextAreaElement;
        if (textArea) {
          const focusEvent = new Event("focus", { bubbles: true });
          textArea.dispatchEvent(focusEvent);
          textArea.value = "Hi, please clarify:";
          textArea.value +=
            "\n\n" +
            selectedWarningItems
              .map((item, index) =>
                selectedWarningItems.length > 1
                  ? `${index + 1}. ${item.askAgentMessage}`
                  : item.askAgentMessage
              )
              .join("\n");

          const inputEvent = new Event("input", { bubbles: true });
          textArea.dispatchEvent(inputEvent);
          const blurEvent = new Event("blur", { bubbles: true });
          textArea.dispatchEvent(blurEvent);

          textArea.style.borderColor = "green";
          textArea.style.transition =
            "border-color 0.3s ease, box-shadow 0.3s ease";
          textArea.style.boxShadow = "0 0 10px rgba(0, 255, 0, 0.7)";
          textArea.scrollIntoView({ behavior: "smooth", block: "center" });

          // Use IntersectionObserver to wait until the text area is in view
          const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
              // Start the pulsating effect
              textArea.style.animation = "pulse 1s infinite";

              // Stop the effect after a few seconds
              setTimeout(() => {
                textArea.style.borderColor = "";
                textArea.style.boxShadow = "";
                textArea.style.animation = "";
                observer.disconnect();
              }, 3000);
            }
          });

          observer.observe(textArea);
        }

        chrome.storage.local.remove("selectedWarningItems");
      }
    });
  });
}
