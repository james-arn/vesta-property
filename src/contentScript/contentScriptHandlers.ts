import { ActionEvents } from "@/constants/actionEvents";
import { StorageKeys } from "@/constants/storage";
import { ConfidenceLevels, ExtractedPropertyScrapingData } from "@/types/property";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { logErrorToSentry } from "@/utils/sentry";
import { extractPropertyDataFromDOM } from "./utils/propertyDataExtractor";
import { clickBroadbandChecker } from "./utils/propertyScrapeHelpers";

// --- State (managed within this module) ---
let currentPropertyData: ExtractedPropertyScrapingData | null = null;
let lastProcessedUrl: string | null = null;

// --- Helper Functions ---
const getPropertyCacheKey = (propertyId: number | string): string => {
  return `${StorageKeys.PROPERTY_DATA_CACHE_PREFIX}${propertyId}`;
};

// --- State Management Functions ---
async function _updateStoredPropertyData(
  data: ExtractedPropertyScrapingData | null
): Promise<void> {
  console.log("[ContentScript State Handler] Updating stored data (in-memory only).", data);
  currentPropertyData = data;
}

export function getStoredPropertyData(): ExtractedPropertyScrapingData | null {
  return currentPropertyData;
}

// --- UI Communication (Internal Helpers) ---
function _sendPropertyDataToUI(data: ExtractedPropertyScrapingData | null): void {
  if (data) {
    console.log(
      "[ContentScript Comm Handler] Sending CONTENT_SCRIPT_PROPERTY_DATA_EXTRACTED.",
      data
    );
    try {
      chrome.runtime.sendMessage({
        action: ActionEvents.CONTENT_SCRIPT_PROPERTY_DATA_EXTRACTED,
        data: data,
      });
    } catch (error) {
      logErrorToSentry(
        `[ContentScript Comm Handler] Error sending CONTENT_SCRIPT_PROPERTY_DATA_EXTRACTED: ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
    }
  } else {
    console.log("[ContentScript Comm Handler] No data to send to UI.");
    _sendShowWarning(window.location.href, "No property data extracted.");
  }
}

function _sendShowWarning(reasonUrl: string, specificMessage?: string): void {
  const message = specificMessage || "Please open a Rightmove property page.";
  const messagePayload = {
    action: ActionEvents.SHOW_WARNING,
    data: `${message} (URL: ${reasonUrl})`,
  };
  console.log(
    `[ContentScript Comm Handler] Sending SHOW_WARNING for URL: ${reasonUrl}`,
    messagePayload
  );
  try {
    chrome.runtime.sendMessage(messagePayload);
  } catch (error) {
    logErrorToSentry(
      `[ContentScript Comm Handler] Error sending SHOW_WARNING: ${error instanceof Error ? error.message : String(error)}`,
      "error"
    );
  }
}

// --- Core Logic Handlers (Exported for Listeners) ---

export async function handlePageModelAvailable(model: RightmovePageModelType): Promise<void> {
  const currentUrl = window.location.href;
  const propertyId = model?.propertyData?.id ?? null;
  const cacheKey = getPropertyCacheKey(propertyId);
  let cachedData: ExtractedPropertyScrapingData | null = null;

  console.log(
    `[ContentScript Handler] handlePageModelAvailable invoked for URL: ${currentUrl}, Property ID: ${propertyId}`
  );

  // Attempt to load from cache first
  if (cacheKey) {
    try {
      const result = await chrome.storage.local.get(cacheKey);
      if (result && result[cacheKey]) {
        cachedData = result[cacheKey] as ExtractedPropertyScrapingData;
        console.log(`[ContentScript Cache] Found cached data for key ${cacheKey}.`, cachedData);
        // Update state and UI immediately with cached data
        await _updateStoredPropertyData(cachedData); // Update local state (will re-save, harmless)
        _sendPropertyDataToUI(cachedData);
      } else {
        console.log(`[ContentScript Cache] No data found in cache for key ${cacheKey}.`);
      }
    } catch (error) {
      logErrorToSentry(
        `[ContentScript Cache] Error getting property data from storage for key ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
        "warning"
      );
    }
  }

  // Regardless of cache, process the current page model unless URL changed during cache load
  if (window.location.href !== currentUrl) {
    console.warn("[ContentScript Handler] URL changed during cache load. Aborting processing.");
    return;
  }

  lastProcessedUrl = currentUrl;

  if (currentUrl.includes("rightmove.co.uk/properties/")) {
    try {
      await clickBroadbandChecker();
    } catch (e) {
      console.warn("[ContentScript Handler] clickBroadbandChecker failed:", e);
    }

    let extractedData: ExtractedPropertyScrapingData | null = null;
    try {
      const cachedAddress = cachedData?.address;
      extractedData = await extractPropertyDataFromDOM(model, cachedAddress);
      // If extraction fails or lacks displayAddress, AND we have cached data, keep cached. Otherwise use extracted.
      if (
        extractedData &&
        !extractedData.address?.displayAddress &&
        cachedData?.address?.displayAddress
      ) {
        console.warn(
          "[ContentScript Handler] Extracted data missing displayAddress, but cached data has one. Merging address."
        );
        extractedData.address = cachedData.address; // Use cached address
      } else if (!extractedData && cachedData) {
        console.warn(
          "[ContentScript Handler] Extraction failed, but cached data exists. Using cached data."
        );
        extractedData = cachedData; // Fallback entirely to cached data if extraction fails
      } else if (extractedData && !extractedData.address?.displayAddress) {
        console.warn(
          "[ContentScript Handler] Extracted data missing displayAddress. Treating as null (no cache fallback)."
        );
        extractedData = null;
      }
    } catch (e) {
      logErrorToSentry(
        `[ContentScript Handler] Error extractPropertyDataFromDOM: ${e instanceof Error ? e.message : String(e)}`,
        "error"
      );
      // If extraction fails, use cached data if available
      extractedData = cachedData ?? null;
    }

    // Update state and cache with the latest processed/merged data
    await _updateStoredPropertyData(extractedData);
    // Send potentially updated data to UI
    _sendPropertyDataToUI(extractedData);
  } else {
    console.log("[ContentScript Handler] URL not property page. Clearing data/showing warning.");
    await _updateStoredPropertyData(null); // Clear state and cache
    _sendShowWarning(currentUrl);
  }
}

export function handlePageModelTimeout(url: string): void {
  console.log(`[ContentScript Handler] handlePageModelTimeout for URL: ${url}`);
  if (window.location.href === url || lastProcessedUrl !== window.location.href) {
    _updateStoredPropertyData(null);
    _sendShowWarning(url, "Could not retrieve property details.");
    lastProcessedUrl = url;
  }
}

export function handleTabOrNavigationUpdate(urlFromBackground: string): void {
  const currentData = getStoredPropertyData();

  if (currentData && lastProcessedUrl === urlFromBackground) {
    console.log(
      "[ContentScript Handler] Resending existing data for focused URL:",
      urlFromBackground
    );
    _sendPropertyDataToUI(currentData);
  } else {
    console.log(
      "[ContentScript Handler] Waiting for new page model events for URL:",
      window.location.href
    );
  }
}

export async function handleAddressLookupResult(payload: {
  fullAddress: string | null;
  // Add other structured fields if they are returned by background script later
}): Promise<void> {
  const currentData = getStoredPropertyData();

  if (currentData && payload.fullAddress) {
    console.log("[ContentScript Handler] Updating address with high confidence.");

    const existingAddress = currentData.address || {};

    const updatedData: ExtractedPropertyScrapingData = {
      ...currentData,
      address: {
        ...existingAddress,
        displayAddress: payload.fullAddress,
        addressConfidence: ConfidenceLevels.HIGH,
      },
    };
    // Update state & SAVE TO CACHE
    await _updateStoredPropertyData(updatedData);
    // Send final updated data to UI
    _sendPropertyDataToUI(updatedData);
  }
}
