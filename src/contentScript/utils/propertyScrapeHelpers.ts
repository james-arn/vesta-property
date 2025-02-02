import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { capitaliseFirstLetter } from "@/utils/text";

export function extractInfoFromPageModelKeyFeaturesAndDescription(
  pageModel: RightmovePageModelType
) {
  const keyFeatures = pageModel.propertyData.keyFeatures || "";
  const description = pageModel.propertyData.text.description || "";
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

export function getBroadbandSpeed(): string | null {
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
