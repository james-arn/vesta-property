import { StorageKeys } from "@/constants/storage";
import { clickBroadbandChecker } from "@/contentScript/utils/propertyScrapeHelpers";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { ActionEvents } from "../../constants/actionEvents";
import {
  retrieveDataFromStorage,
  storeDataToStorage,
} from "../../storageHelpers";
import { PropertyDataList } from "../../types/property";
import { extractPropertyDataFromDOM } from "../utils/propertyDataExtractor";

// Sets up event listeners for the content script
export function setupContentScriptEventListeners() {
  let pageModel: RightmovePageModelType | null = null;

  window.addEventListener("message", (event: any) => {
    if (
      event.source !== window ||
      event.data.type !== ActionEvents.PAGE_MODEL_AVAILABLE
    ) {
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
    if (request.action === ActionEvents.NAVIGATE_TO_CONTACT_AGENT_PAGE) {
      const selectedWarningItems: PropertyDataList[] =
        request.data.selectedWarningItems;

      storeDataToStorage(
        StorageKeys.SELECTED_WARNING_ITEMS,
        selectedWarningItems,
        () => {
          console.log("Selected warning items stored.");

          // Navigate to the new URL
          window.location.href = request.data.url;
        }
      );
    }

    if (request.action === ActionEvents.NAVIGATE_BACK_TO_PROPERTY_LISTING) {
      window.location.href = request.data.url;
    }
  });

  window.addEventListener("load", () => {
    console.log("Content Script: Window loaded");
    retrieveDataFromStorage(StorageKeys.SELECTED_WARNING_ITEMS).then(
      (selectedWarningItems) => {
        if (selectedWarningItems) {
          console.log(
            "Retrieved selected warning items:",
            selectedWarningItems
          );

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
                .map((item: PropertyDataList, index: number) =>
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
      }
    );
  });

  const observeDOMChanges = () => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" || mutation.type === "attributes") {
          const confirmationPage = document.querySelector(
            '[data-test="confirmationPage"]'
          );
          const confirmationBanner = document.querySelector(
            '[data-test="confirmationBanner"]'
          );

          if (confirmationPage || confirmationBanner) {
            console.log("Successful form submission detected");
            chrome.runtime.sendMessage({
              action: ActionEvents.AGENT_CONTACT_FORM_SUBMITTED,
            });
            observer.disconnect();
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  };

  // Initialize the observer
  observeDOMChanges();
}
