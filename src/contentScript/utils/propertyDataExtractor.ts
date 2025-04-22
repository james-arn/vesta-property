import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import {
  extractInfoFromPageModelKeyFeaturesAndDescription,
  formatPropertySize,
  getBroadbandData,
  getNearbySchools,
  isRentalProperty,
} from "@/contentScript/utils/propertyScrapeHelpers";
import { ListedBuilding } from "@/types/premiumStreetData";
import {
  Confidence,
  ConfidenceLevels,
  DataStatus,
  EpcData,
  EpcDataSourceType,
  ExtractedPropertyScrapingData,
  RightOfWayDetails,
} from "@/types/property";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { logErrorToSentry } from "@/utils/sentry";
import getPropertySalesInsights from "./propertySalesInsights";
import { ListedPropertyDetailsResult } from "./propertyScrapeHelpers";

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
    miningImpactPropertyItem,
    miningImpactStatus,
    listedProperty: listedPropertyFromUnstructuredText,
    epcRating: epcRatingFromText,
    leaseTerm: leaseTermFromText,
    groundRent: groundRentFromText,
    serviceCharge: serviceChargeFromText,
  } = extractInfoFromPageModelKeyFeaturesAndDescription(pageModel);

  // Attempt to extract EPC value directly from page model or DOM first

  const initialEpcValue = epcRatingFromText;
  const initialEpcConfidence: Confidence = initialEpcValue
    ? ConfidenceLevels.HIGH
    : ConfidenceLevels.NONE;
  const initialSource: EpcDataSourceType = initialEpcValue
    ? EpcDataSourceType.LISTING
    : EpcDataSourceType.NONE;

  const epcUrl =
    (pageModel?.propertyData?.epcGraphs?.length ?? 0) > 0 &&
    pageModel?.propertyData?.epcGraphs?.[0]?.url
      ? pageModel?.propertyData?.epcGraphs?.[0]?.url
      : null;

  const epcData: EpcData = {
    url: epcUrl,
    scores: null,
    value: initialEpcValue,
    confidence: initialEpcConfidence,
    source: initialSource,
    error: null,
  };

  const floorPlan =
    pageModel?.propertyData?.floorplans &&
    pageModel?.propertyData?.floorplans?.length > 0 &&
    pageModel?.propertyData?.floorplans?.[0]?.url
      ? pageModel?.propertyData?.floorplans?.[0]?.url
      : CHECKLIST_NO_VALUE.NOT_MENTIONED;

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

  const propertyType = pageModel?.propertyData?.propertySubType || propertyTypeElement || null;
  const tenure = pageModel?.propertyData?.tenure?.tenureType || tenureElement || null;
  const listingHistory =
    pageModel?.propertyData?.listingHistory?.listingUpdateReason ||
    CHECKLIST_NO_VALUE.NOT_MENTIONED;
  const address = {
    displayAddress:
      pageModel?.propertyData?.address?.displayAddress ||
      locationElement?.textContent?.trim() ||
      null,
    postcode: `${pageModel?.propertyData?.address?.outcode ?? ""} ${pageModel?.propertyData?.address?.incode ?? ""}`,
    isAddressConfirmedByUser: false,
  };
  const locationCoordinates = {
    lat: pageModel?.propertyData?.location?.latitude ?? null,
    lng: pageModel?.propertyData?.location?.longitude ?? null,
  };
  const windows = windowsFromUnstructuredText || CHECKLIST_NO_VALUE.NOT_MENTIONED;
  const nearestTrainStations = pageModel?.propertyData?.nearestStations ?? [];
  const nearbySchools = await getNearbySchools();
  const broadbandData = await getBroadbandData();

  const propertyData: ExtractedPropertyScrapingData = {
    propertyId: pageModel?.propertyData?.id ?? null,
    accessibility:
      pageModel?.propertyData?.features?.accessibility
        ?.map((feature: any) => feature?.displayText)
        ?.filter(Boolean)
        .join(", ") ||
      accessibilityFromUnstructuredText ||
      CHECKLIST_NO_VALUE.NOT_MENTIONED,
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
    broadband: broadbandData,
    buildingSafety: buildingSafetyResultFromUnstructuredText || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    coastalErosion: coastalErosionResultFromUnstructuredText || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    copyLinkUrl: pageModel?.metadata?.copyLinkUrl ?? null,
    councilTax: pageModel?.propertyData?.livingCosts?.councilTaxBand || councilTaxElement || null,
    epc: epcData,
    floodedInLastFiveYears:
      pageModel?.propertyData?.features?.risks?.floodedInLastFiveYears ?? null,
    floodDefences: pageModel?.propertyData?.features?.risks?.floodDefences ?? null,
    floodSources: pageModel?.propertyData?.features?.risks?.floodSources ?? null,
    floorPlan: floorPlan,
    garden:
      pageModel?.propertyData?.features?.garden?.[0]?.displayText ||
      gardenFromUnstructuredText ||
      CHECKLIST_NO_VALUE.NOT_MENTIONED,
    heating:
      pageModel?.propertyData?.features?.heating?.[0]?.displayText ||
      heatingFromUnstructuredText ||
      CHECKLIST_NO_VALUE.NOT_MENTIONED,
    isRental,
    listedProperty: mapScrapedStatusToListedBuildings(listedPropertyFromUnstructuredText),
    listingHistory: listingHistory || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    address: address,
    locationCoordinates: locationCoordinates,
    miningImpact: miningImpactPropertyItem || {
      value: CHECKLIST_NO_VALUE.NOT_MENTIONED,
      status: DataStatus.ASK_AGENT,
      reason: "Could not determine mining impact.",
    },
    miningImpactStatus: miningImpactStatus ?? null,
    parking: pageModel?.propertyData?.features?.parking?.[0]?.displayText || parkingElement || null,
    privateRightOfWayObligation:
      pageModel?.propertyData?.features?.obligations?.requiredAccess ?? null,
    propertyType: propertyType,
    publicRightOfWayObligation: mapBooleanToRightOfWayDetails(
      pageModel?.propertyData?.features?.obligations?.rightsOfWay
    ),
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
    tenure: tenure,
    windows: windows,
    leaseTerm: leaseTermFromText || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    groundRent: groundRentFromText || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    serviceCharge: serviceChargeFromText,
    nearestStations: nearestTrainStations,
    nearbySchools: nearbySchools,
  };

  return propertyData;
}

// Helper function to map boolean to RightOfWayDetails
const mapBooleanToRightOfWayDetails = (
  exists: boolean | null | undefined
): RightOfWayDetails | null => {
  if (exists === null || exists === undefined) {
    return null;
  }
  // Create the minimal object based on the boolean
  return {
    exists: exists,
    distance: null,
    date_updated: null,
    parish: null,
    route_no: null,
    row_type: null,
  };
};

// Helper function to map scraped listed status to the ListedBuilding array structure
const mapScrapedStatusToListedBuildings = (
  scrapedData: ListedPropertyDetailsResult | null
): ListedBuilding[] | null => {
  if (!scrapedData || scrapedData.isListed === null) {
    return null; // Status unknown or no data scraped
  }

  // Case 1: Confirmed not listed
  if (scrapedData.isListed === false) {
    return []; // Empty array signifies checked and confirmed not listed
  }

  // Case 2: Potentially listed (status is true)
  if (scrapedData.isListed === true) {
    // Create a single placeholder object
    const placeholderBuilding: ListedBuilding = {
      id: null,
      name: null,
      grade: null, // Set grade to null as we can't reliably extract it
      listed_date: null,
      amended_date: null,
      location: null,
      distance_in_metres: null,
    };
    return [placeholderBuilding];
  }

  // Fallback: Should not be reached if logic above is correct, but treat as unknown
  console.warn("Unhandled listed building mapping case:", scrapedData);
  return null;
};
