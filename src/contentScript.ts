import { ActionEvents } from "./constants/actionEvents";

//contentScript.ts is injected into the web page and interacts with the DOM to scrape data.
function extractPropertyData() {
  const priceElement = Array.from(document.querySelectorAll('strong')).find(el => el.textContent?.includes('€'));
  const locationElement = Array.from(document.querySelectorAll('h1')).find(el => el.textContent?.includes('flat for sale'));
  const bedroomsElement = Array.from(document.querySelectorAll('li')).find(el => el.textContent?.includes('T3'));
  const bathroomsElement = Array.from(document.querySelectorAll('li')).find(el => el.textContent?.includes('bathroom'));
  const imagesElement = Array.from(document.querySelectorAll('p')).find(el => el.textContent?.includes('photos'));
  return {
    price: priceElement?.textContent?.trim() || null,
    location: locationElement?.textContent?.trim() || null,
    bedrooms: bedroomsElement?.textContent?.trim() || null,
    bathrooms: bathroomsElement?.textContent?.trim() || null,
    images: imagesElement?.textContent?.trim() || null,
  };
};

console.log("contentScript.ts loaded");

// // Check if the current page URL matches the desired pattern
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content Script: Received message:", request);
  if (request.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
    const currentUrl = request.url;
    console.log("Content Script: Current URL:", currentUrl);
    if (currentUrl.includes('rightmove.co.uk/properties/')) {
      const propertyData = extractPropertyData();
      console.log("Content Script: Extracted property data:", propertyData);
      chrome.runtime.sendMessage({ action: ActionEvents.UPDATE_PROPERTY_DATA, data: propertyData });
    } else {
      console.log("Content Script: URL does not match the desired pattern. Sending warning message.");
      chrome.runtime.sendMessage({
        action: ActionEvents.SHOW_WARNING,
        message: 'Please open a property page on rightmove.co.uk.',
      });
    }
  }
});
