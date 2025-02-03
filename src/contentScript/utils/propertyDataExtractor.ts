import {
  extractInfoFromPageModelKeyFeaturesAndDescription,
  formatPropertySize,
  getBroadbandSpeedFromDOM,
} from "@/contentScript/utils/propertyScrapeHelpers";
import { RightmovePageModelType } from "@/types/rightmovePageModel";

export function extractPropertyDataFromDOM(
  pageModel: RightmovePageModelType | null
) {
  if (!pageModel)
    console.error("No page model available, attempting data only from DOM");

  const {
    heating: heatingFromUnstructuredText,
    windows: windowsFromUnstructuredText,
    garden: gardenFromUnstructuredText,
    accessibility: accessibilityFromUnstructuredText,
  } = extractInfoFromPageModelKeyFeaturesAndDescription(pageModel);
  const epc =
    (pageModel?.propertyData?.epcGraphs?.length ?? 0) > 0 &&
    pageModel?.propertyData?.epcGraphs?.[0]?.url
      ? pageModel?.propertyData?.epcGraphs?.[0]?.url
      : "Ask agent";

  const floorPlan =
    pageModel?.propertyData?.floorplans &&
    pageModel?.propertyData?.floorplans?.length > 0 &&
    pageModel?.propertyData?.floorplans?.[0]?.url
      ? pageModel?.propertyData?.floorplans?.[0]?.url
      : "Ask agent";

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

  const phoneNumber =
    pageModel?.propertyData?.contactInfo?.telephoneNumbers?.localNumber ||
    pageModel?.propertyData?.contactInfo?.telephoneNumbers?.internationalNumber
      ? `${pageModel?.propertyData?.contactInfo?.telephoneNumbers?.localNumber || pageModel?.propertyData?.contactInfo?.telephoneNumbers?.internationalNumber}`
      : null;

  return {
    agent: {
      name: pageModel?.propertyData?.customer?.branchDisplayName,
      contactUrl: pageModel?.metadata?.emailAgentUrl,
      phoneNumber: phoneNumber,
    },
    copyLinkUrl: pageModel?.metadata?.copyLinkUrl,
    price:
      pageModel?.propertyData?.prices?.primaryPrice ||
      priceElement?.textContent?.trim() ||
      null,
    location:
      pageModel?.propertyData?.address?.displayAddress ||
      locationElement?.textContent?.trim() ||
      null,
    propertyType:
      pageModel?.propertyData?.propertySubType || propertyTypeElement || null,
    tenure:
      pageModel?.propertyData?.tenure?.tenureType || tenureElement || null,
    bedrooms:
      pageModel?.propertyData?.bedrooms?.toString() || bedroomsElement || null,
    bathrooms:
      pageModel?.propertyData?.bathrooms?.toString() ||
      bathroomsElement ||
      null,
    parking:
      pageModel?.propertyData?.features?.parking?.[0]?.displayText ||
      parkingElement ||
      null,
    garden:
      pageModel?.propertyData?.features?.garden?.[0]?.displayText ||
      gardenFromUnstructuredText ||
      "Ask agent",
    councilTax:
      pageModel?.propertyData?.livingCosts?.councilTaxBand ||
      councilTaxElement ||
      null,
    size: formatPropertySize(pageModel?.propertyData?.sizings) || sizeElement,
    heating:
      pageModel?.propertyData?.features?.heating?.[0]?.displayText ||
      heatingFromUnstructuredText ||
      "Ask agent",
    floorPlan: floorPlan,

    epc: epc,
    broadband: (() => {
      const broadbandFeature =
        pageModel?.propertyData?.features?.broadband?.[0]?.displayText;
      const broadbandSpeed = getBroadbandSpeedFromDOM();
      if (broadbandFeature && broadbandSpeed) {
        return `${broadbandFeature}, ${broadbandSpeed}`;
      } else if (broadbandFeature) return broadbandFeature;
      else if (broadbandSpeed) return broadbandSpeed;
      else return "Ask agent";
    })(),
    listingHistory:
      pageModel?.propertyData?.listingHistory?.listingUpdateReason ||
      "Ask agent",
    windows: windowsFromUnstructuredText || "Ask agent",
    publicRightOfWayObligation:
      pageModel?.propertyData?.features?.obligations?.rightsOfWay,
    privateRightOfWayObligation:
      pageModel?.propertyData?.features?.obligations?.requiredAccess,
    listedProperty: pageModel?.propertyData?.features?.obligations?.listed,

    restrictions: pageModel?.propertyData?.features?.obligations?.restrictions,
    floodDefences: pageModel?.propertyData?.features?.risks?.floodDefences,
    floodSources: pageModel?.propertyData?.features?.risks?.floodSources,
    floodedInLastFiveYears:
      pageModel?.propertyData?.features?.risks?.floodedInLastFiveYears,
    accessibility:
      pageModel?.propertyData?.features?.accessibility &&
      pageModel?.propertyData?.features?.accessibility?.length > 0
        ? pageModel?.propertyData?.features?.accessibility
            ?.map((item) => item.displayText)
            .join(", ") ||
          accessibilityFromUnstructuredText ||
          "Ask agent"
        : "Ask agent",
  };
}
