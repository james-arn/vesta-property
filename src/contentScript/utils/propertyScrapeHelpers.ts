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
import { DataStatus } from "@/types/property";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { capitaliseFirstLetterAndCleanString } from "@/utils/text";

export function computeTermChecklistResult(
  termResult: TermExtractionResult | null,
  subject: string
): { status: DataStatus; displayValue: string; askAgentMessage: string } {
  if (!termResult) {
    return {
      status: DataStatus.ASK_AGENT,
      displayValue: "Not mentioned",
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
  const displayValue = displayValueParts.join(" | ") || "Not mentioned";

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

export function extractInfoFromPageModelKeyFeaturesAndDescription(
  pageModel: RightmovePageModelType | null
) {
  // TODO: Create back up if pageModel isn't available grabbing the text from the DOM
  const keyFeatures = pageModel?.propertyData?.keyFeatures || "";
  const description = pageModel?.propertyData?.text?.description || "";
  const combinedText = `${keyFeatures} ${description}`.toLowerCase();

  const heatingMatches = combinedText.match(heatingRegex);
  const gardenMatches = combinedText.match(gardenRegex);
  const parkingMatches = combinedText.match(parkingRegex);
  const windowMatches = windowTerms.filter((term) => combinedText.includes(term));
  const accessibilityMatches = accessibilityTerms.filter((term) => combinedText.includes(term));

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
    return "Not mentioned";
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
  let result = "Not mentioned";

  if (broadbandFeature && broadbandSpeed) {
    result = `${broadbandFeature}, ${broadbandSpeed}`;
  }
  if (broadbandFeature && !broadbandSpeed) {
    result = broadbandFeature;
  } else if (broadbandSpeed && !broadbandFeature) {
    result = broadbandSpeed;
  }

  const speedValue = broadbandSpeed ? parseFloat(broadbandSpeed) : null;
  if (speedValue && speedValue <= 10) {
    result += " - slow speed";
  }
  if (speedValue && speedValue > 10) {
    result += " - good speed";
  }

  return result;
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
    console.error("Property sale history button not found.");
  }
}
