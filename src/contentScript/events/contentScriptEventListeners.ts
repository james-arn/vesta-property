import { StorageKeys } from "@/constants/storage";
import { clickBroadbandChecker } from "@/contentScript/utils/propertyScrapeHelpers";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { ActionEvents } from "../../constants/actionEvents";
import { retrieveDataFromStorage, storeDataToStorage } from "../../storageHelpers";
import { PropertyDataList } from "../../types/property";
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
        // No action needed, as the sidebar can use the step directly
      } else if (currentUrl.includes("rightmove.co.uk/properties/")) {
        const propertyData = await extractPropertyDataFromDOM(pageModel);
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
      const selectedWarningItems: PropertyDataList[] = request.data.selectedWarningItems;

      storeDataToStorage(StorageKeys.SELECTED_WARNING_ITEMS, selectedWarningItems, () => {
        console.log("Selected warning items stored.");

        // Navigate to the new URL
        window.location.href = request.data.url;
      });
    }

    if (request.action === ActionEvents.NAVIGATE_BACK_TO_PROPERTY_LISTING) {
      window.location.href = request.data.url;
    }
  });

  function proceedAutoWrite() {
    retrieveDataFromStorage(StorageKeys.SELECTED_WARNING_ITEMS).then((selectedWarningItems) => {
      if (selectedWarningItems) {
        console.log("Retrieved selected warning items:", selectedWarningItems);

        const textArea = document.querySelector("textarea#comments") as HTMLTextAreaElement;
        if (textArea) {
          const focusEvent = new Event("focus", { bubbles: true });
          textArea.dispatchEvent(focusEvent);
          textArea.value = "Hi, please clarify:";
          textArea.value +=
            "\n\n" +
            selectedWarningItems
              .map((item: any, index: number) =>
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
          textArea.style.transition = "border-color 0.3s ease, box-shadow 0.3s ease";
          textArea.style.boxShadow = "0 0 10px rgba(0, 255, 0, 0.7)";
          textArea.scrollIntoView({ behavior: "smooth", block: "center" });

          // Use IntersectionObserver to trigger pulsating effect
          const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
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
  }

  // For currentStep === STEPS.RIGHTMOVE_SIGN_IN, we check if the sign in page has appeared and guide user to continue as guest or sign in manually
  window.addEventListener("load", () => {
    // Check if the sign in page is loaded by detecting the password form
    if (document.querySelector("#password-form")) {
      // send messages to the extension to update the UI
      chrome.runtime.sendMessage({
        action: ActionEvents.RIGHTMOVE_SIGN_IN_PAGE_OPENED,
        data: null,
      });
      const signInPoller = setInterval(() => {
        // Poll until the password form is no longer present
        if (!document.querySelector("#password-form")) {
          clearInterval(signInPoller);
          // Notify the UI that sign in is complete and we’ve moved on to the next step.
          chrome.runtime.sendMessage({
            action: ActionEvents.RIGHTMOVE_SIGN_IN_COMPLETED,
          });
          proceedAutoWrite();
        }
      }, 1000);
      return;
    }
    proceedAutoWrite();
  });

  const observeEmailAgentSentDOMChanges = () => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" || mutation.type === "attributes") {
          const confirmationPage = document.querySelector('[data-test="confirmationPage"]');
          const confirmationBanner = document.querySelector('[data-test="confirmationBanner"]');

          if (confirmationPage || confirmationBanner) {
            console.log("Successful email agent form submission detected");
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
  observeEmailAgentSentDOMChanges();
}
