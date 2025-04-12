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
import { gardenRegex, heatingRegex, parkingRegex } from "@/constants/regex";
import { TermExtractionResult } from "@/types/domScraping";
import { DataStatus, PropertyItem } from "@/types/property";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { logErrorToSentry } from "@/utils/sentry";
import { capitaliseFirstLetterAndCleanString } from "@/utils/text";

// --- Constants ---
const EPC_RATING_REGEX = /EPC(?:\s+Rating)?\s*[:\-]?\s*([A-G])/i;

export function computeTermChecklistResult(
  termResult: TermExtractionResult | null,
  subject: string
): { status: DataStatus; displayValue: string; askAgentMessage: string } {
  if (!termResult) {
    return {
      status: DataStatus.ASK_AGENT,
      displayValue: CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: `I couldn't find any ${subject.toLowerCase()} details. Can you please confirm?`,
    };
  }

  // Build the display string to include both positive and negative matches (if any)
  let displayValueParts: string[] = [];
  if (termResult.positive.length > 0) {
    displayValueParts.push(`Positive: ${termResult.positive.join(", ")}`);
  }
  if (termResult.negative.length > 0) {
    displayValueParts.push(`Negative: ${termResult.negative.join(", ")}`);
  }
  const displayValue = displayValueParts.join(" | ") || CHECKLIST_NO_VALUE.NOT_MENTIONED;

  // Set status: If there are any negative details or no positive details, using ASK_AGENT.
  const status =
    termResult.negative.length > 0 || termResult.positive.length === 0
      ? DataStatus.ASK_AGENT
      : DataStatus.FOUND_POSITIVE;

  // Construct the appropriate ask-agent message
  let askAgentMessage = "";
  if (status === DataStatus.ASK_AGENT) {
    askAgentMessage =
      termResult.negative.length > 0
        ? `I noticed for ${subject}, you mentioned the following: ${termResult.negative.join(
            ", "
          )}. Can you provide more details?`
        : `Can you please confirm ${subject.toLowerCase()} details? `;
  }

  return {
    status,
    displayValue,
    askAgentMessage,
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

  const buildingSafetyChecklist = computeTermChecklistResult(matchResult, subject);
  return buildingSafetyChecklist;
}

export function getListedPropertyDetails(
  pageModel: RightmovePageModelType | null,
  combinedText: string
): PropertyItem {
  const obligations = pageModel?.propertyData?.features?.obligations?.listed;
  const listingRegex = /grade\s*(ii\*?|i)/gi;

  // Capture any grade matches (preserving an asterisk, if present)
  const matches: string[] = [];
  let regexMatch: RegExpExecArray | null = null;
  while ((regexMatch = listingRegex.exec(combinedText)) !== null) {
    // Use the captured numeral portion and preserve the asterisk (if present) in uppercase.
    const numeral = regexMatch[1].toUpperCase();
    matches.push(`Grade ${numeral}`);
  }

  // Remove duplicate matches and join them for display
  const uniqueGrades = matches.length > 0 ? [...new Set(matches)] : [];
  const gradeFormatted = uniqueGrades.length > 0 ? uniqueGrades.join(", ") : null;

  // Determine the string value based on the obligations flag and grade info.
  let listingStatus: string = CHECKLIST_NO_VALUE.NOT_MENTIONED;
  if (obligations === true) {
    listingStatus = gradeFormatted ? `Yes - (${gradeFormatted})` : "Yes";
  } else if (obligations === false) {
    listingStatus = "No";
  } else if (obligations === null && uniqueGrades.length > 0) {
    listingStatus = `Yes - (${gradeFormatted})`;
  }

  // Compute the DataStatus based on the final string.
  const lowerCaseListing = listingStatus.toLowerCase().trim();
  const computedStatus = (() => {
    switch (lowerCaseListing) {
      case "no":
        return DataStatus.FOUND_POSITIVE;
      default:
        return DataStatus.ASK_AGENT;
    }
  })();

  // Provide a context-specific reason based on the computed status and value.
  const reason = (() => {
    switch (computedStatus) {
      case DataStatus.FOUND_POSITIVE:
        return ""; // No agent message required
      case DataStatus.ASK_AGENT:
        if (lowerCaseListing === "yes" || lowerCaseListing.startsWith("yes -")) {
          return "Are there any important details or restrictions I should know as it's a listed property?";
        } else if (
          lowerCaseListing === CHECKLIST_NO_VALUE.NOT_MENTIONED ||
          lowerCaseListing === "ask agent"
        ) {
          return "Is the property listed?";
        } else {
          return "Is the property listed?";
        }
      default:
        return "Is the property listed?";
    }
  })();

  return {
    value: listingStatus,
    status: computedStatus,
    reason,
  };
}

export function extractInfoFromPageModelKeyFeaturesAndDescription(
  pageModel: RightmovePageModelType | null
) {
  // TODO: Create back up if pageModel isn't available grabbing the text from the DOM
  const keyFeatures = pageModel?.propertyData?.keyFeatures || "";
  const description = pageModel?.propertyData?.text?.description || "";
  const combinedText = `${keyFeatures} ${description}`.toLowerCase();

  // --- Extract EPC from combined text ---
  const epcMatch = combinedText.match(EPC_RATING_REGEX);
  const epcRatingFromText = epcMatch && epcMatch[1] ? epcMatch[1].toUpperCase() : null;

  const heatingMatches = combinedText.match(heatingRegex);
  const gardenMatches = combinedText.match(gardenRegex);
  const parkingMatches = combinedText.match(parkingRegex);
  const windowMatches = windowTerms.filter((term) => combinedText.includes(term));
  const accessibilityMatches = accessibilityTerms.filter((term) => combinedText.includes(term));

  const bathroomRegex = /(?:en[-\s]?suite\s*bathroom|ensuite\s*bathroom|bathroom)/gi;
  const bathroomMatches = combinedText.match(bathroomRegex);
  const bathroomFormatted = bathroomMatches
    ? capitaliseFirstLetterAndCleanString([...new Set(bathroomMatches)].join(", "))
    : null;

  const buildingSafetyResult = extractTermInfo(
    "Building Safety",
    combinedText,
    buildingSafetyTermsPositive,
    buildingSafetyTermsNegative
  );

  const coastalErosionResult = extractTermInfo(
    "Coastal Erosion",
    combinedText,
    coastalErosionTermsPositive,
    coastalErosionTermsNegative
  );

  const miningImpactResult = extractTermInfo(
    "Mining Impact",
    combinedText,
    miningImpactTermsPositive,
    miningImpactTermsNegative
  );

  const hasCommunalGarden = combinedText.includes("communal garden");

  const listedProperty = getListedPropertyDetails(pageModel, combinedText);

  console.log("[property scrape helpers] garden matches found:", gardenMatches);

  return {
    heating: heatingMatches
      ? capitaliseFirstLetterAndCleanString([...new Set(heatingMatches)].join(", "))
      : null,
    garden: hasCommunalGarden
      ? "Communal garden"
      : gardenMatches
        ? capitaliseFirstLetterAndCleanString([...new Set(gardenMatches)].join(", "))
        : null,
    parking: parkingMatches ? [...new Set(parkingMatches)] : null,
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
    miningImpact: {
      value: miningImpactResult.displayValue,
      status: miningImpactResult.status,
      reason: miningImpactResult.askAgentMessage,
    },
    epcRating: epcRatingFromText,
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
  const broadbandDiv = document.querySelector('div[data-gtm-name="broadband-checker"]');

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
  const broadbandDiv = document.querySelector('div[data-gtm-name="broadband-checker"]');
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

export function getBroadbandInfo(pageModel: RightmovePageModelType | null): string {
  const broadbandFeature = pageModel?.propertyData?.features?.broadband?.[0]?.displayText;
  const broadbandSpeed = getBroadbandSpeedFromDOM();
  const speedValue = broadbandSpeed ? parseFloat(broadbandSpeed) : null;

  if (!broadbandFeature && !broadbandSpeed) {
    return CHECKLIST_NO_VALUE.NOT_MENTIONED;
  }

  if (broadbandFeature && broadbandSpeed) {
    const baseInfo = `${broadbandFeature}, ${broadbandSpeed}`;
    if (speedValue && speedValue <= 10) {
      return `${baseInfo} - slow speed`;
    }
    if (speedValue && speedValue > 10) {
      return `${baseInfo} - good speed`;
    }
    return baseInfo;
  }

  if (broadbandFeature) {
    return broadbandFeature;
  }

  const speedInfo = broadbandSpeed as string;
  if (speedValue && speedValue <= 10) {
    return `${speedInfo} - slow speed`;
  }
  if (speedValue && speedValue > 10) {
    return `${speedInfo} - good speed`;
  }

  return speedInfo;
}

export function clickPropertySaleHistoryButton() {
  const buttons = document.querySelectorAll('button[aria-expanded="false"]');
  const targetButton = Array.from(buttons).find((button) =>
    button.textContent?.includes("Property sale history")
  );

  if (targetButton) {
    (targetButton as HTMLButtonElement).click();
    console.log("Property sale history button clicked.");
  } else {
    logErrorToSentry("Property sale history button not found.");
  }
}
