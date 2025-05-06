import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import {
  accessibilityTerms,
  buildingSafetyTermsNegative,
  buildingSafetyTermsPositive,
  coastalErosionTermsNegative,
  coastalErosionTermsPositive,
  miningImpactTermsNegative,
  miningImpactTermsPositive,
  windowTerms,
} from "@/constants/keyTerms";
import {
  BROADBAND_BUTTON_SELECTOR,
  BROADBAND_SPEED_VALUE_SELECTOR,
  DEFAULT_WAIT_TIMEOUT,
  EPC_RATING_REGEX,
  GROUND_RENT_REGEX,
  LEASE_TERM_REGEX,
  MONTHLY_CHARGE_PERIOD_REGEX,
  NEARBY_SCHOOLS_BUTTON_SELECTOR,
  SALE_HISTORY_ROW_SELECTOR,
  SCHOOL_ROW_SELECTOR_PREFIX,
  SERVICE_CHARGE_ANNUAL_REGEX,
  SERVICE_CHARGE_REGEX,
} from "@/constants/propertyScrapeConsts";
import { gardenRegex, heatingRegex, parkingRegex } from "@/constants/regex";
import { TermExtractionResult } from "@/types/domScraping";
import { DataStatus, NearbySchool, PropertyItem, SaleHistoryEntry } from "@/types/property";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { parseMonetaryValue } from "@/utils/formatting";
import { logErrorToSentry } from "@/utils/sentry";
import { capitaliseFirstLetterAndCleanString } from "@/utils/text";

export function computeTermChecklistResult(
  termResult: TermExtractionResult | null,
  subject: string
): {
  status: DataStatus;
  displayValue: string;
  askAgentMessage: string;
  impactStatus: boolean | null;
} {
  if (!termResult) {
    return {
      status: DataStatus.ASK_AGENT,
      displayValue: CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: `I couldn't find any ${subject.toLowerCase()} details. Can you please confirm?`,
      impactStatus: null,
    };
  }

  // Determine the fundamental boolean status
  const hasNegative = termResult.negative.length > 0;
  const hasPositive = termResult.positive.length > 0;
  let impactStatus: boolean | null = null;
  if (hasNegative) {
    impactStatus = true; // Negative impact detected
  } else if (hasPositive) {
    impactStatus = false; // No negative, only positive = no impact
  } // else: no positive or negative terms found -> impactStatus remains null

  // Build the display string to include both positive and negative matches (if any)
  let displayValueParts: string[] = [];
  if (hasPositive) {
    displayValueParts.push(`Positive terms: ${termResult.positive.join(", ")}`);
  }
  if (hasNegative) {
    displayValueParts.push(`Negative terms: ${termResult.negative.join(", ")}`);
  }
  const displayValue = displayValueParts.join(" | ") || CHECKLIST_NO_VALUE.NOT_MENTIONED;

  // Set DataStatus based on boolean status
  const status =
    impactStatus === true
      ? DataStatus.FOUND_NEGATIVE
      : impactStatus === false
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT; // If null (unknown/not mentioned)

  // Construct the appropriate ask-agent message
  let askAgentMessage = "";
  if (status !== DataStatus.FOUND_POSITIVE) {
    // Ask agent if negative or unknown
    askAgentMessage =
      impactStatus === true // If negative impact found
        ? `I noticed for ${subject}, you mentioned potential issues: ${termResult.negative.join(", ")}. Can you provide more details?`
        : `Can you please confirm ${subject.toLowerCase()} details?`; // If unknown/not mentioned
  }

  return {
    status,
    displayValue,
    askAgentMessage,
    impactStatus,
  };
}

function extractTermInfo(
  subject: string,
  combinedText: string,
  positiveTerms: string[],
  negativeTerms: string[]
) {
  const lowerText = combinedText.toLowerCase();
  const positiveMatches = positiveTerms.filter((term) => lowerText.includes(term));
  const negativeMatches = negativeTerms.filter((term) => lowerText.includes(term));
  const matchResult = { positive: positiveMatches, negative: negativeMatches };

  const termChecklist = computeTermChecklistResult(matchResult, subject);
  return termChecklist;
}

// Updated return type to reflect simplification
export interface ListedPropertyDetailsResult extends PropertyItem {
  isListed: boolean | null;
}

export function getListedPropertyDetails(
  pageModel: RightmovePageModelType | null,
  combinedText: string
): ListedPropertyDetailsResult {
  // Use updated return type
  const obligations = pageModel?.propertyData?.features?.obligations?.listed;
  const lowerCombinedText = combinedText.toLowerCase();

  // Determine if potentially listed
  let isListed: boolean | null = null;
  if (obligations === true) {
    isListed = true;
  } else if (obligations === false) {
    isListed = false;
  } else {
    // Fallback to text search if obligations flag is null/undefined
    const mentionsListed = /listed\s*building|grade\s*(i|ii)/i.test(lowerCombinedText);
    if (mentionsListed) {
      isListed = true;
    }
    // If not mentioned and obligations unknown, remains null
  }

  // Generate display string (can still mention grade if found by simple regex)
  const gradeMatch = lowerCombinedText.match(/grade\s*(ii\*?|i)/i);
  const gradeFormatted = gradeMatch ? `Grade ${gradeMatch[1].toUpperCase()}` : null;

  let listingStatus: string = CHECKLIST_NO_VALUE.NOT_MENTIONED;
  if (isListed === true) {
    listingStatus = gradeFormatted ? `Yes - (${gradeFormatted})` : "Yes";
  } else if (isListed === false) {
    listingStatus = "No";
  }

  // Compute DataStatus based on the determined listing status
  const computedStatus = ((): DataStatus => {
    if (isListed === true) {
      return DataStatus.ASK_AGENT; // Always ask agent if listed, as details are unknown
    } else if (isListed === false) {
      return DataStatus.FOUND_POSITIVE; // Confirmed not listed
    } else {
      return DataStatus.ASK_AGENT; // Status unknown, ask agent
    }
  })();

  // Provide a context-specific reason
  const reason = (() => {
    if (computedStatus === DataStatus.FOUND_POSITIVE) {
      return ""; // No agent message required
    }
    if (isListed === true) {
      return "Are there any important details or restrictions I should know as it's potentially a listed property?";
    }
    // Default for unknown status
    return "Is the property listed?";
  })();

  return {
    value: listingStatus,
    status: computedStatus,
    reason,
    isListed,
  };
}

export function extractInfoFromPageModelKeyFeaturesAndDescription(
  pageModel: RightmovePageModelType | null
) {
  const keyFeatures = pageModel?.propertyData?.keyFeatures || "";
  const description = pageModel?.propertyData?.text?.description || "";
  const combinedText = `${keyFeatures} ${description}`;
  const combinedTextLower = combinedText.toLowerCase();

  // --- Extract EPC from combined text ---
  const epcMatch = combinedTextLower.match(EPC_RATING_REGEX);
  const epcRatingFromText = epcMatch && epcMatch[1] ? epcMatch[1].toUpperCase() : null;

  const heatingMatches = combinedTextLower.match(heatingRegex);
  const gardenMatches = combinedTextLower.match(gardenRegex);
  const parkingMatches = combinedTextLower.match(parkingRegex);
  const windowMatches = windowTerms.filter((term) => combinedTextLower.includes(term));
  const accessibilityMatches = accessibilityTerms.filter((term) =>
    combinedTextLower.includes(term)
  );

  const bathroomRegex = /(?:en[-\s]?suite\s*bathroom|ensuite\s*bathroom|bathroom)/gi;
  const bathroomMatches = combinedTextLower.match(bathroomRegex);
  const bathroomFormatted = bathroomMatches
    ? capitaliseFirstLetterAndCleanString([...new Set(bathroomMatches)].join(", "))
    : null;

  const buildingSafetyResult = extractTermInfo(
    "Building Safety",
    combinedTextLower,
    buildingSafetyTermsPositive,
    buildingSafetyTermsNegative
  );

  const coastalErosionResult = extractTermInfo(
    "Coastal Erosion",
    combinedTextLower,
    coastalErosionTermsPositive,
    coastalErosionTermsNegative
  );

  const miningImpactResult = extractTermInfo(
    "Mining Impact",
    combinedTextLower,
    miningImpactTermsPositive,
    miningImpactTermsNegative
  );

  const hasCommunalGarden = combinedTextLower.includes("communal garden");

  const listedProperty = getListedPropertyDetails(pageModel, combinedTextLower);

  const leaseTermMatch = combinedTextLower.match(LEASE_TERM_REGEX);
  const leaseTermValue = leaseTermMatch && leaseTermMatch[1] ? `${leaseTermMatch[1]} years` : null;

  const groundRentMatch = combinedTextLower.match(GROUND_RENT_REGEX);
  const groundRentValue = groundRentMatch && groundRentMatch[1] ? groundRentMatch[1] : null;

  const serviceChargeAnnualMatch = combinedTextLower.match(SERVICE_CHARGE_ANNUAL_REGEX);
  const serviceChargeMatch = combinedTextLower.match(SERVICE_CHARGE_REGEX);
  let serviceChargeValue: number | null = null;

  if (serviceChargeAnnualMatch && serviceChargeAnnualMatch[1]) {
    // Prioritize explicit annual amount
    const annualAmount = parseMonetaryValue(serviceChargeAnnualMatch[1]);
    serviceChargeValue = annualAmount;
  } else if (serviceChargeMatch && serviceChargeMatch[1]) {
    // Fallback to general service charge amount, check for pcm
    const amountString = serviceChargeMatch[1];
    const periodString = serviceChargeMatch[2]; // Capture group 2 for the period
    const parsedAmount = parseMonetaryValue(amountString);

    if (parsedAmount !== null) {
      const isMonthly = periodString && MONTHLY_CHARGE_PERIOD_REGEX.test(periodString);
      serviceChargeValue = isMonthly ? parsedAmount * 12 : parsedAmount;
    }
  }

  return {
    heating: heatingMatches
      ? capitaliseFirstLetterAndCleanString([...new Set(heatingMatches)].join(", "))
      : null,
    garden: hasCommunalGarden
      ? "Communal garden"
      : gardenMatches
        ? capitaliseFirstLetterAndCleanString([...new Set(gardenMatches)].join(", "))
        : null,
    parking: parkingMatches ? [...new Set(parkingMatches)].join(", ") : null,
    windows: windowMatches
      ? capitaliseFirstLetterAndCleanString([...new Set(windowMatches)].join(", "))
      : null,
    accessibility: accessibilityMatches
      ? capitaliseFirstLetterAndCleanString([...new Set(accessibilityMatches)].join(", "))
      : null,
    bathroom: bathroomFormatted,
    listedProperty: listedProperty,
    buildingSafety: {
      value: buildingSafetyResult.displayValue,
      status: buildingSafetyResult.status,
      reason: buildingSafetyResult.askAgentMessage,
    },
    coastalErosion: {
      value: coastalErosionResult.displayValue,
      status: coastalErosionResult.status,
      reason: coastalErosionResult.askAgentMessage,
    },
    miningImpactPropertyItem: {
      value: miningImpactResult.displayValue,
      status: miningImpactResult.status,
      reason: miningImpactResult.askAgentMessage,
    },
    miningImpactStatus: miningImpactResult.impactStatus,
    epcRating: epcRatingFromText,
    leaseTerm: leaseTermValue,
    groundRent: groundRentValue,
    serviceCharge: serviceChargeValue,
  };
}

export function isRentalProperty(pageModel: RightmovePageModelType | null): boolean {
  if (!pageModel) return false;
  return (
    pageModel.propertyData.transactionType === "RENT" ||
    pageModel.propertyData.channel === "RES_LET"
  );
}

export const isFloorPlanPresent = () => {
  // Check for the "No floorplan" text
  const noFloorplanText = Array.from(document.querySelectorAll("div")).some((div) =>
    div.innerText.includes("No floorplan")
  );

  if (noFloorplanText) {
    console.log("Floor plan is missing.");
    return false;
  }

  // Check if an <img> tag related to a floor plan exists
  const floorPlanImg = Array.from(document.querySelectorAll("img")).find((img) =>
    img.alt?.toLowerCase().includes("floorplan")
  );

  if (floorPlanImg) {
    console.log("Floor plan is present.");
    return true;
  }

  // Check for links pointing to floor plan
  const floorPlanLink = Array.from(document.querySelectorAll("a")).find((a) =>
    a.href?.includes("#/floorplan")
  );

  if (floorPlanLink) {
    console.log("Floor plan is present.");
    return true;
  }

  console.log("Floor plan is missing.");
  return false;
};

export function clickBroadbandChecker() {
  const broadbandDiv = document.querySelector(BROADBAND_BUTTON_SELECTOR);

  if (broadbandDiv) {
    const broadbandButton = broadbandDiv.querySelector("button") as HTMLButtonElement;

    if (broadbandButton) {
      broadbandButton.click();
      console.log("Broadband checker button clicked.");
    } else {
      console.error("Broadband button not found within the broadband checker div.");
    }
  } else {
    console.error("Broadband checker div not found.");
  }
}

export function getBroadbandSpeedFromDOM(): string | null {
  const broadbandDiv = document.querySelector(BROADBAND_BUTTON_SELECTOR);
  if (!broadbandDiv) {
    console.error("Broadband checker div not found.");
    return null;
  }

  console.log("[property scrape helpers] Searching for broadband speed elements.");
  const speedElements = broadbandDiv.querySelectorAll("p");

  console.log(
    "[property scrape helpers] Filtering speed elements to find the one ending with 'Mb'."
  );
  const speedElement = Array.from(speedElements).find((element) =>
    (element.textContent || "").trim().endsWith("Mb")
  );

  const result = speedElement ? speedElement.textContent?.trim() || null : null;
  console.log(`[property scrape helpers] Broadband speed found: ${result}`);
  return result;
}

export function convertSizeToSquareFeet(size: number, unit: string): string {
  const conversionFactor = unit === "ac" ? 43560 : 10.764;
  return Math.ceil(size * conversionFactor).toLocaleString();
}

export function formatPropertySize(
  sizings?: {
    unit: string;
    displayUnit: string;
    minimumSize: number;
    maximumSize: number;
  }[]
): string {
  if (!sizings || sizings.length === 0) {
    return CHECKLIST_NO_VALUE.NOT_MENTIONED;
  }

  const sizeInAcres = sizings.find((sizing) => sizing.unit === "ac" && sizing.maximumSize >= 1);
  const sizeInSquareFeet = sizings.find((sizing) => sizing.unit === "sqft");
  const sizeInSquareMeters = sizings.find((sizing) => sizing.unit === "sqm");

  const formattedSizes = [];

  if (sizeInAcres) {
    const sizeInOriginalUnit = sizeInAcres.maximumSize.toFixed(0);
    const sizeInSquareFeet = convertSizeToSquareFeet(sizeInAcres.maximumSize, sizeInAcres.unit);
    formattedSizes.push(
      `${sizeInOriginalUnit} ${sizeInAcres.displayUnit} (${sizeInSquareFeet} sq ft)`
    );
  } else if (sizeInSquareMeters) {
    const sizeInOriginalUnit = sizeInSquareMeters.maximumSize.toFixed(0);
    const sizeInSquareFeet = (sizeInSquareMeters.maximumSize * 10.764).toFixed(0);
    formattedSizes.push(
      `${sizeInOriginalUnit} ${sizeInSquareMeters.displayUnit} (${sizeInSquareFeet} sq ft)`
    );
  } else if (sizeInSquareFeet) {
    const sizeInOriginalUnit = sizeInSquareFeet.maximumSize.toLocaleString();
    formattedSizes.push(`${sizeInOriginalUnit} ${sizeInSquareFeet.displayUnit}`);
  }

  return formattedSizes.join(" / ");
}

export function clickPropertySaleHistoryButton() {
  try {
    const buttons = document.querySelectorAll('button[aria-expanded="false"]');
    const targetButton = Array.from(buttons).find((button) =>
      button.textContent?.includes("Property sale history")
    );
    if (targetButton) {
      (targetButton as HTMLButtonElement).click();
    }
  } catch (error) {
    logErrorToSentry(error, "error");
    console.error("Error clicking property sale history button:", error);
  }
}

// Helper function to wait for an element to appear in the DOM
// Use with caution - delays UI load
const waitForElement = (
  selector: string,
  timeout = DEFAULT_WAIT_TIMEOUT
): Promise<Element | null> => {
  return new Promise((resolve) => {
    const intervalTime = 100;
    let timeElapsed = 0;

    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        resolve(element);
      } else {
        timeElapsed += intervalTime;
        if (timeElapsed >= timeout) {
          clearInterval(interval);
          console.warn(`Element with selector "${selector}" not found within ${timeout}ms.`);
          resolve(null); // Timeout
        }
      }
    };

    const interval = setInterval(checkElement, intervalTime);
    checkElement(); // Initial check
  });
};

/**
 * Clicks the broadband check button and waits for the speed information to load.
 * @returns The broadband speed string (e.g., "Ultrafast 1000 Mbps") or NOT_MENTIONED.
 */
export const getBroadbandData = async (): Promise<string> => {
  try {
    // Find the button using its specific data-gtm-name selector
    const broadbandButtonContainer = document.querySelector<HTMLElement>(BROADBAND_BUTTON_SELECTOR);
    const broadbandButton = broadbandButtonContainer?.querySelector("button");

    if (!broadbandButton) {
      console.warn("Broadband check button or its container not found.");
      return CHECKLIST_NO_VALUE.NOT_MENTIONED;
    }

    broadbandButton.click();

    // Wait for the main broadband widget to appear using its data-testid
    const broadbandWidget = await waitForElement(BROADBAND_SPEED_VALUE_SELECTOR, 1000);

    if (!broadbandWidget) {
      console.warn("Broadband widget did not appear after clicking button.");
      return CHECKLIST_NO_VALUE.NOT_MENTIONED;
    }

    // Search within the widget for the speed paragraph
    const paragraphElements = broadbandWidget.querySelectorAll("p");
    const speedRegex = /^(\d+)(Mb|Gb)$/i; // Matches digits followed by Mb or Gb

    const speedParagraph = Array.from(paragraphElements).find((p) =>
      speedRegex.test(p.textContent?.trim() || "")
    );

    if (speedParagraph?.textContent) {
      // Optionally combine with the preceding paragraph if it describes the speed type (e.g., "Ultrafast")
      const speedDescriptionElement = speedParagraph.previousElementSibling;
      let fullSpeedText = speedParagraph.textContent.trim();

      if (
        speedDescriptionElement &&
        speedDescriptionElement.tagName === "P" &&
        speedDescriptionElement.textContent
      ) {
        fullSpeedText = `${speedDescriptionElement.textContent.trim()} ${fullSpeedText}`;
      }
      return fullSpeedText;
    } else {
      console.warn("Broadband speed paragraph not found within the widget.");
      return CHECKLIST_NO_VALUE.NOT_MENTIONED;
    }
  } catch (error) {
    logErrorToSentry(error, "error");
    console.error("Error getting broadband data:", error);
    return CHECKLIST_NO_VALUE.NOT_MENTIONED;
  }
};

// Helper function to get nearby schools
export async function getNearbySchools(): Promise<NearbySchool[]> {
  try {
    const schoolsButton = document.querySelector<HTMLButtonElement>(NEARBY_SCHOOLS_BUTTON_SELECTOR);
    if (!schoolsButton) {
      console.warn("Nearby schools button not found.");
      return [];
    }

    schoolsButton.click();

    // Wait for the first school row to ensure the section has loaded
    // Construct the specific selector for the first school element
    const firstSchoolSelector = '[data-test="school-0"]';
    const firstSchoolRowToCheckListApepars = await waitForElement(firstSchoolSelector, 2000);

    if (!firstSchoolRowToCheckListApepars) {
      console.warn("Nearby schools section did not load after clicking button.");
      return [];
    }

    const schoolElements = document.querySelectorAll<HTMLElement>(SCHOOL_ROW_SELECTOR_PREFIX);
    const schools: NearbySchool[] = Array.from(schoolElements)
      .map((element): NearbySchool | null => {
        const contentContainer = element.querySelector<HTMLElement>("a > div:nth-of-type(2)");
        if (!contentContainer) {
          console.warn("Could not find the main content container div for a school entry.");
          return null;
        }

        // Find all spans within the content container
        const spans = contentContainer.querySelectorAll<HTMLElement>("span");

        // Find the distance div (assuming it's the last div within its direct parent)
        const distanceElement = contentContainer.querySelector<HTMLElement>("div > div:last-child");

        // Extract data based on assumed order of spans
        const nameElement = spans[0]; // Assuming first span is name
        const typeElement = spans[1]; // Assuming second span is type
        const ratingElement = spans[2]; // Assuming third span is rating

        if (!nameElement || !typeElement || !ratingElement || !distanceElement) {
          console.warn("Missing data elements for a school entry based on structural selectors.");
          return null; // Skip this entry if essential data is missing
        }

        const ratingText = ratingElement.textContent?.trim() || CHECKLIST_NO_VALUE.NOT_MENTIONED;
        const typeText = typeElement.textContent?.trim() || CHECKLIST_NO_VALUE.NOT_MENTIONED;
        const distanceText = distanceElement.textContent?.trim() || "";

        // Parse distance from the dedicated distance element
        let distance: number | null = null;
        let unit: string | null = null;
        if (distanceText) {
          const match = distanceText.trim().match(/([\d.]+)\s*([a-zA-Z]+)$/);
          if (match) {
            distance = parseFloat(match[1]);
            unit = match[2] || null; // Capture the unit (e.g., "miles")
          }
        }

        return {
          name: nameElement.textContent?.trim() || CHECKLIST_NO_VALUE.NOT_MENTIONED,
          type: typeText,
          distance: distance,
          unit: unit,
          // Using the full text from the third span for both rating label and body
          ratingLabel: ratingText,
          ratingBody: ratingText,
        };
      })
      .filter((school): school is NearbySchool => school !== null);

    return schools;
  } catch (error) {
    logErrorToSentry(error, "error");
    console.error("Error getting nearby schools:", error);
    return []; // Return empty array on error
  }
}

/**
 * Clicks the property sale history button and waits for the history table to load.
 * @returns An array of sale history entries or an empty array if not found/error.
 */
export const getSaleHistory = async (): Promise<SaleHistoryEntry[]> => {
  try {
    clickPropertySaleHistoryButton(); // Assume this function exists and clicks the button

    const firstHistoryRow = await waitForElement(SALE_HISTORY_ROW_SELECTOR, 2000);
    if (!firstHistoryRow) {
      console.warn("Sale history table did not load after clicking button.");
      return [];
    }

    const historyElements = document.querySelectorAll<HTMLElement>(SALE_HISTORY_ROW_SELECTOR);
    const saleHistory: SaleHistoryEntry[] = Array.from(historyElements)
      .map((element): SaleHistoryEntry | null => {
        const dateElement = element.querySelector<HTMLElement>('[data-testid="sale-history-date"]');
        const priceElement = element.querySelector<HTMLElement>(
          '[data-testid="sale-history-price"]'
        );
        const detailsElement = element.querySelector<HTMLElement>(
          '[data-testid^="sale-history-details-"]' // Use starts-with for potentially dynamic IDs
        );

        if (!dateElement || !priceElement) {
          console.warn("Missing date or price elements for a sale history entry.");
          return null;
        }

        // Map extracted data to SaleHistoryEntry fields
        // Assuming 'date' maps to 'year', 'price' to 'soldPrice'.
        // 'percentageChange' is not directly available from these selectors, setting to NOT_MENTIONED.
        // 'details' might contain info for percentage change, but requires parsing logic not implemented here.
        return {
          year: dateElement.textContent?.trim() || CHECKLIST_NO_VALUE.NOT_MENTIONED, // Map date to year
          soldPrice: priceElement.textContent?.trim() || CHECKLIST_NO_VALUE.NOT_MENTIONED, // Map price to soldPrice
          percentageChange: CHECKLIST_NO_VALUE.NOT_MENTIONED, // Placeholder
          // details: detailsElement?.textContent?.trim() || CHECKLIST_NO_VALUE.NOT_MENTIONED, // Original details field removed
        };
      })
      .filter((entry): entry is SaleHistoryEntry => entry !== null); // Filter out null entries

    return saleHistory; // Added missing return statement
  } catch (error) {
    logErrorToSentry(error, "error");
    console.error("Error fetching sale history:", error);
    return []; // Return empty array on error
  }
};

/**
 * Extracts a numerical speed in Mbps from a broadband speed string.
 * Handles "Mb" and "Gb" units, returning null if no valid speed is found.
 * @param speedString - The broadband speed string (e.g., "Ultrafast 900Mb", "1Gb").
 * @returns The speed in Mbps as a number, or null.
 */
export const extractMbpsFromString = (speedString: string | null | undefined): number | null => {
  if (!speedString) {
    return null;
  }

  // Regex to find number followed by Mb or Gb (case-insensitive)
  const speedRegex = /(\d+(\.\d+)?)\s*(Mb|Gb)/i;
  const match = speedString.match(speedRegex);

  if (!match) {
    return null; // No valid speed found
  }

  const numberPart = parseFloat(match[1]);
  const unitPart = match[3].toLowerCase();

  if (isNaN(numberPart)) {
    return null; // Should not happen with regex, but good practice
  }

  // Convert Gb to Mb if necessary
  return unitPart === "gb" ? numberPart * 1000 : numberPart;
};
