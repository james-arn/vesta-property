import { processRightmovePageModel } from "@/contentScript/utils/processRightMovePageModel";
import { isFloorPlanPresent } from "@/contentScript/utils/propertyScrapeHelpers";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { capitaliseFirstLetter } from "@/utils/text";

export function extractPropertyDataFromDOM(
  pageModel: RightmovePageModelType | null
) {
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
