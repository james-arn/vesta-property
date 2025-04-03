import {
  extractInfoFromPageModelKeyFeaturesAndDescription,
  formatPropertySize,
  getBroadbandInfo,
  isRentalProperty,
} from "@/contentScript/utils/propertyScrapeHelpers";
import { ExtractedPropertyScrapingData } from "@/types/property";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { logErrorToSentry } from "@/utils/sentry";
import getPropertySalesInsights from "./propertySalesInsights";

export async function extractPropertyDataFromDOM(
  pageModel: RightmovePageModelType | null
): Promise<ExtractedPropertyScrapingData> {
  if (!pageModel)
    logErrorToSentry("No page model available, attempting data only from DOM", "fatal");

  // Page model extraction
  const {
    heating: heatingFromUnstructuredText,
    windows: windowsFromUnstructuredText,
    garden: gardenFromUnstructuredText,
    bathroom: bathroomFromUnstructuredText,
    accessibility: accessibilityFromUnstructuredText,
    buildingSafety: buildingSafetyResultFromUnstructuredText,
    coastalErosion: coastalErosionResultFromUnstructuredText,
    miningImpact: miningImpactResultFromUnstructuredText,
    listedProperty: listedPropertyFromUnstructuredText,
  } = extractInfoFromPageModelKeyFeaturesAndDescription(pageModel);

  // Initialize basic EPC data without processing - this will be handled in the background script
  const epcUrl =
    (pageModel?.propertyData?.epcGraphs?.length ?? 0) > 0 &&
    pageModel?.propertyData?.epcGraphs?.[0]?.url
      ? pageModel?.propertyData?.epcGraphs?.[0]?.url
      : null;

  const epc = {
    url: epcUrl,
    scores: null, // Scores will be processed in the background script
  };

  const floorPlan =
    pageModel?.propertyData?.floorplans &&
    pageModel?.propertyData?.floorplans?.length > 0 &&
    pageModel?.propertyData?.floorplans?.[0]?.url
      ? pageModel?.propertyData?.floorplans?.[0]?.url
      : "Not mentioned";

  const phoneNumber =
    pageModel?.propertyData?.contactInfo?.telephoneNumbers?.localNumber ||
    pageModel?.propertyData?.contactInfo?.telephoneNumbers?.internationalNumber
      ? `${pageModel?.propertyData?.contactInfo?.telephoneNumbers?.localNumber || pageModel?.propertyData?.contactInfo?.telephoneNumbers?.internationalNumber}`
      : null;

  // DOM extraction
  const priceElement = Array.from(document.querySelectorAll("span")).find((el) =>
    el?.textContent?.includes("£")
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

  const salePrice =
    pageModel?.propertyData?.prices?.primaryPrice || priceElement?.textContent?.trim() || null;
  const {
    priceDiscrepancyValue,
    priceDiscrepancyStatus,
    priceDiscrepancyReason,
    compoundAnnualGrowthRate,
    volatility,
  } = await getPropertySalesInsights(salePrice);

  const isRental = isRentalProperty(pageModel);

  return {
    propertyId: pageModel?.propertyData?.id ?? null,
    accessibility:
      pageModel?.propertyData?.features?.accessibility &&
      pageModel?.propertyData?.features?.accessibility?.length > 0
        ? pageModel?.propertyData?.features?.accessibility
            ?.map((item) => item.displayText)
            .join(", ") ||
          accessibilityFromUnstructuredText ||
          "Not mentioned"
        : "Not mentioned",
    agent: {
      name: pageModel?.propertyData?.customer?.branchDisplayName ?? "",
      contactUrl: pageModel?.metadata?.emailAgentUrl ?? "",
      phoneNumber: phoneNumber,
    },
    bathrooms:
      pageModel?.propertyData?.bathrooms?.toString() ||
      bathroomsElement ||
      bathroomFromUnstructuredText ||
      null,
    bedrooms: pageModel?.propertyData?.bedrooms?.toString() || bedroomsElement || null,
    broadband: getBroadbandInfo(pageModel),
    buildingSafety: buildingSafetyResultFromUnstructuredText,
    coastalErosion: coastalErosionResultFromUnstructuredText,
    copyLinkUrl: pageModel?.metadata?.copyLinkUrl ?? null,
    councilTax: pageModel?.propertyData?.livingCosts?.councilTaxBand || councilTaxElement || null,
    epc: epc,
    floodedInLastFiveYears:
      pageModel?.propertyData?.features?.risks?.floodedInLastFiveYears ?? null,
    floodDefences: pageModel?.propertyData?.features?.risks?.floodDefences ?? null,
    floodSources: pageModel?.propertyData?.features?.risks?.floodSources ?? null,
    floorPlan: floorPlan,
    garden:
      pageModel?.propertyData?.features?.garden?.[0]?.displayText ||
      gardenFromUnstructuredText ||
      "Not mentioned",
    heating:
      pageModel?.propertyData?.features?.heating?.[0]?.displayText ||
      heatingFromUnstructuredText ||
      "Not mentioned",
    isRental,
    listedProperty: listedPropertyFromUnstructuredText ?? null,
    listingHistory: pageModel?.propertyData?.listingHistory?.listingUpdateReason || "Not mentioned",
    address: {
      displayAddress:
        pageModel?.propertyData?.address?.displayAddress ||
        locationElement?.textContent?.trim() ||
        null,
      postcode: `${pageModel?.propertyData?.address?.outcode ?? ""} ${pageModel?.propertyData?.address?.incode ?? ""}`,
      isAddressConfirmedByUser: false,
    },
    locationCoordinates: {
      lat: pageModel?.propertyData?.location?.latitude ?? null,
      lng: pageModel?.propertyData?.location?.longitude ?? null,
    },
    miningImpact: miningImpactResultFromUnstructuredText,
    parking: pageModel?.propertyData?.features?.parking?.[0]?.displayText || parkingElement || null,
    privateRightOfWayObligation:
      pageModel?.propertyData?.features?.obligations?.requiredAccess ?? null,
    propertyType: pageModel?.propertyData?.propertySubType || propertyTypeElement || null,
    publicRightOfWayObligation: pageModel?.propertyData?.features?.obligations?.rightsOfWay ?? null,
    restrictions: pageModel?.propertyData?.features?.obligations?.restrictions ?? null,
    salePrice,
    salesHistory: {
      priceDiscrepancy: {
        value: priceDiscrepancyValue,
        status: priceDiscrepancyStatus,
        reason: priceDiscrepancyReason,
      },
      compoundAnnualGrowthRate,
      volatility,
    },
    size: formatPropertySize(pageModel?.propertyData?.sizings) || sizeElement || null,
    tenure: pageModel?.propertyData?.tenure?.tenureType || tenureElement || null,
    windows: windowsFromUnstructuredText || "Not mentioned",
  };
}
