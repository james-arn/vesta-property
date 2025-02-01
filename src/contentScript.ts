import { ActionEvents } from "./constants/actionEvents";
import { PropertyDataList } from "./types/property";
import { RightmovePageModelType } from "./types/rightmovePageModel";
import { processRightmovePageModel } from "./utils/processRightMovePageModel";
import {
  clickBroadbandChecker,
  isFloorPlanPresent,
} from "./utils/propertyScrapeHelpers";
import { capitaliseFirstLetter } from "./utils/text";

//contentScript.ts is injected into the web page and interacts with the DOM to scrape data.
declare const window: any;
const RightMovePageModel: RightmovePageModelType = window.PAGE_MODEL;

function injectExternalScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injectScript.js");
  document.documentElement.appendChild(script);
  script.onload = () => script.remove();
}

export let pageModel: RightmovePageModelType | null = null;
window.addEventListener("message", (event: any) => {
  if (event.source !== window || event.data.type !== "PAGE_MODEL_AVAILABLE") {
    return;
  }
  clickBroadbandChecker();
  pageModel = event.data.pageModel;
  console.log("Extracted PAGE_MODEL:", pageModel);
});

injectExternalScript();

function extractPropertyData() {
  console.log("pageModel:", pageModel);
  const pageModelData = processRightmovePageModel(pageModel);
  console.log("processed pageModelData:", pageModelData);
  if (pageModelData) return pageModelData;

  // Fallback to DOM extraction
  const priceElement = Array.from(document.querySelectorAll("span")).find(
    (el) => el?.textContent?.includes("£")
  );
  const locationElement = document.querySelector("h1");
  const propertyTypeElement = Array.from(document.querySelectorAll("dt"))
    .find((dt) => dt.textContent?.includes("PROPERTY TYPE"))
    ?.nextElementSibling?.textContent?.trim();
  const tenureElement = Array.from(document.querySelectorAll("dt"))
    .find((dt) => dt.textContent?.includes("TENURE"))
    ?.nextElementSibling?.textContent?.trim();
  const bedroomsElement = Array.from(document.querySelectorAll("dt"))
    .find((dt) => dt.textContent?.includes("BEDROOMS"))
    ?.nextElementSibling?.textContent?.trim();
  const bathroomsElement = Array.from(document.querySelectorAll("dt"))
    .find((dt) => dt.textContent?.includes("BATHROOMS"))
    ?.nextElementSibling?.textContent?.trim();
  const parkingElement = Array.from(document.querySelectorAll("dt"))
    .find((dt) => dt.textContent?.includes("PARKING"))
    ?.nextElementSibling?.textContent?.trim();
  const gardenElement = Array.from(document.querySelectorAll("dt"))
    .find((dt) => dt.textContent?.includes("GARDEN"))
    ?.nextElementSibling?.textContent?.trim();
  const councilTaxElement = Array.from(document.querySelectorAll("dt"))
    .find((dt) => dt.textContent?.includes("COUNCIL TAX"))
    ?.nextElementSibling?.textContent?.trim();
  const sizeElement = Array.from(document.querySelectorAll("dt"))
    .find((dt) => dt.textContent?.includes("SIZE"))
    ?.nextElementSibling?.textContent?.trim();

  const extractInfoFromKeyFeatureAndDescription = () => {
    const heatingRegex =
      /\b(?:gas central heating|electric heating|electric central heating|underfloor heating|radiators|boiler)\b/gi;
    const gardenRegex = /\bgarden\b/gi;
    const parkingRegex = /\bparking\b/gi;

    // Function to get text by label (Key Features, Description)
    const getTextByHeading = (headingText: string) => {
      const heading = Array.from(document.querySelectorAll("h2")).find((el) =>
        el.textContent?.includes(headingText)
      );
      return heading?.nextElementSibling?.textContent || "";
    };

    // Extract text from Key Features and Description
    const keyFeatures = getTextByHeading("Key features");
    const description = getTextByHeading("Description");

    // Combine and search for terms
    const allText = `${keyFeatures} ${description}`;
    const heatingMatches = allText.match(heatingRegex);
    const gardenMatches = allText.match(gardenRegex);
    const parkingMatches = allText.match(parkingRegex);

    return {
      heating: heatingMatches
        ? capitaliseFirstLetter([...new Set(heatingMatches)].join(", "))
        : null,
      garden: gardenMatches ? [...new Set(gardenMatches)] : null,
      parking: parkingMatches ? [...new Set(parkingMatches)] : null,
    };
  };

  const { heating } = extractInfoFromKeyFeatureAndDescription();

  return {
    price: priceElement?.textContent?.trim() || null,
    location: locationElement?.textContent?.trim() || null,
    propertyType: propertyTypeElement || null,
    tenure: tenureElement || null,
    bedrooms: bedroomsElement || null,
    bathrooms: bathroomsElement || null,
    parking: parkingElement || null,
    garden: gardenElement || null,
    councilTax: councilTaxElement || null,
    size: sizeElement || null,
    heating: heating || "Ask agent",
    floorPlan: isFloorPlanPresent() ? "Yes" : "Ask agent",
  };
}

console.log("contentScript.ts loaded");

// // Check if the current page URL matches the desired pattern
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content Script: Received message:", request);
  if (request.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
    const currentUrl = request.data;
    console.log("Content Script: Current URL:", currentUrl);
    if (currentUrl.includes("rightmove.co.uk/properties/")) {
      const propertyData = extractPropertyData();
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
