import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { capitaliseFirstLetter } from "@/utils/text";

export function extractInfoFromPageModelKeyFeaturesAndDescription(
  pageModel: RightmovePageModelType | null
) {
  // TODO: Create back up if pageModel isn't available grabbing the text from the DOM
  const keyFeatures = pageModel?.propertyData?.keyFeatures || "";
  const description = pageModel?.propertyData?.text?.description || "";
  const combinedText = `${keyFeatures} ${description}`.toLowerCase();

  const windowTerms = [
    "double glazing",
    "double glazed",
    "triple glazing",
    "triple glazed",
    "single glazing",
    "single glazed",
    "secondary glazing",
    "secondary glazed",
    "uPVC",
    "timber frames",
    "aluminium frames",
    "sealed units",
    "glazing replacement",
  ];
  const accessibilityTerms = [
    "step-free access to property",
    "wheelchair accessible parking",
    "level access throughout property",
    "wet room within property",
    "step-free access into garden",
    "disabled access",
  ];
  const heatingRegex =
    /\b(?:gas central heating|electric heating|electric central heating|underfloor heating|radiators|boiler)\b/gi;
  const gardenRegex = /\bgarden\b(?!.*communal garden)/gi;
  const parkingRegex = /\bparking\b/gi;

  const heatingMatches = combinedText.match(heatingRegex);
  const gardenMatches = combinedText.match(gardenRegex);
  const parkingMatches = combinedText.match(parkingRegex);
  const windowMatches = windowTerms.filter((term) =>
    combinedText.includes(term)
  );
  const accessibilityMatches = accessibilityTerms.filter((term) =>
    combinedText.includes(term)
  );
  const hasCommunalGarden = combinedText.includes("communal garden");

  console.log("[property scrape helpers] garden matches found:", gardenMatches);

  return {
    heating: heatingMatches
      ? capitaliseFirstLetter([...new Set(heatingMatches)].join(", "))
      : null,
    garden: hasCommunalGarden
      ? "Communal garden"
      : gardenMatches
        ? capitaliseFirstLetter([...new Set(gardenMatches)].join(", "))
        : null,
    parking: parkingMatches ? [...new Set(parkingMatches)] : null,
    windows: windowMatches
      ? capitaliseFirstLetter([...new Set(windowMatches)].join(", "))
      : null,
    accessibility: accessibilityMatches
      ? capitaliseFirstLetter([...new Set(accessibilityMatches)].join(", "))
      : null,
  };
}

export const isFloorPlanPresent = () => {
  // Check for the "No floorplan" text
  const noFloorplanText = Array.from(document.querySelectorAll("div")).some(
    (div) => div.innerText.includes("No floorplan")
  );

  if (noFloorplanText) {
    console.log("Floor plan is missing.");
    return false;
  }

  // Check if an <img> tag related to a floor plan exists
  const floorPlanImg = Array.from(document.querySelectorAll("img")).find(
    (img) => img.alt?.toLowerCase().includes("floorplan")
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
  const broadbandDiv = document.querySelector(
    'div[data-gtm-name="broadband-checker"]'
  );

  if (broadbandDiv) {
    const broadbandButton = broadbandDiv.querySelector(
      "button"
    ) as HTMLButtonElement;

    if (broadbandButton) {
      broadbandButton.click();
      console.log("Broadband checker button clicked.");
    } else {
      console.error(
        "Broadband button not found within the broadband checker div."
      );
    }
  } else {
    console.error("Broadband checker div not found.");
  }
}

export function getBroadbandSpeedFromDOM(): string | null {
  const broadbandDiv = document.querySelector(
    'div[data-gtm-name="broadband-checker"]'
  );
  if (!broadbandDiv) {
    console.error("Broadband checker div not found.");
    return null;
  }

  console.log(
    "[property scrape helpers] Searching for broadband speed elements."
  );
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
    return "Ask agent";
  }

  const sizeInAcres = sizings.find(
    (sizing) => sizing.unit === "ac" && sizing.maximumSize >= 1
  );
  const sizeInSquareFeet = sizings.find((sizing) => sizing.unit === "sqft");
  const sizeInSquareMeters = sizings.find((sizing) => sizing.unit === "sqm");

  const formattedSizes = [];

  if (sizeInAcres) {
    const sizeInOriginalUnit = sizeInAcres.maximumSize.toFixed(0);
    const sizeInSquareFeet = convertSizeToSquareFeet(
      sizeInAcres.maximumSize,
      sizeInAcres.unit
    );
    formattedSizes.push(
      `${sizeInOriginalUnit} ${sizeInAcres.displayUnit} (${sizeInSquareFeet} sq ft)`
    );
  } else if (sizeInSquareMeters) {
    const sizeInOriginalUnit = sizeInSquareMeters.maximumSize.toFixed(0);
    const sizeInSquareFeet = (sizeInSquareMeters.maximumSize * 10.764).toFixed(
      0
    );
    formattedSizes.push(
      `${sizeInOriginalUnit} ${sizeInSquareMeters.displayUnit} (${sizeInSquareFeet} sq ft)`
    );
  } else if (sizeInSquareFeet) {
    const sizeInOriginalUnit = sizeInSquareFeet.maximumSize.toLocaleString();
    formattedSizes.push(
      `${sizeInOriginalUnit} ${sizeInSquareFeet.displayUnit}`
    );
  }

  return formattedSizes.join(" / ");
}
