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
    if (request.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
      const currentUrl = request.data;
      console.log("Content Script: Current URL:", currentUrl);
      if (currentUrl.includes("rightmove.co.uk/properties/")) {
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
    if (request.action === ActionEvents.FILL_RIGHTMOVE_CONTACT_FORM) {
      const selectedWarningItems: PropertyDataList[] =
        request.data.selectedWarningItems;
      console.log(
        "Content Script: Filling Rightmove contact form with:",
        selectedWarningItems
      );
      console.log("contentScript.ts: DOMContentLoaded");
      const textArea = document.querySelector(
        "textarea#comments"
      ) as HTMLTextAreaElement;
      console.log("contentScript.ts: textArea:", textArea);
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

        // Simulate input and blur so field doesn't reset
        const inputEvent = new Event("input", { bubbles: true });
        textArea.dispatchEvent(inputEvent);
        const blurEvent = new Event("blur", { bubbles: true });
        textArea.dispatchEvent(blurEvent);

        textArea.style.borderColor = "green";
        textArea.style.transition =
          "border-color 0.3s ease, box-shadow 0.3s ease";
        textArea.style.boxShadow = "0 0 10px rgba(0, 255, 0, 0.7)";

        const styleSheet = document.styleSheets[0];
        styleSheet.insertRule(
          `
          @keyframes pulse {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
            100% {
              transform: scale(1);
            }
          }
        `,
          styleSheet.cssRules.length
        );

        textArea.scrollIntoView({ behavior: "smooth", block: "center" });

        // Use IntersectionObserver to wait until the text area is in view
        const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            // Start the pulsating effect
            textArea.style.animation = "pulse 1s infinite"; // Start pulsating effect

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
    }
  });
}
