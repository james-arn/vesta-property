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
import { EPC_RATING_REGEX } from "../../constants/propertyScrapeConsts";
import getPropertySalesInsights from "./propertySalesInsights";
import { ListedPropertyDetailsResult } from "./propertyScrapeHelpers";

const extractTextWithRegex = (text: string | undefined, regex: RegExp): string | undefined => {
  if (!text) return undefined;
  const match = text.match(regex);
  return match?.[1];
};

export async function extractPropertyDataFromDOM(
  pageModel: RightmovePageModelType | null
): Promise<ExtractedPropertyScrapingData> {
  if (!pageModel)
    logErrorToSentry("No page model available, attempting data only from DOM", "fatal");

  // --- Step 1: Extract initial data from pageModel ---
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
    epcRating: epcRatingFromPageModelText,
    leaseTerm: leaseTermFromText,
    groundRent: groundRentFromText,
    serviceCharge: serviceChargeFromText,
  } = extractInfoFromPageModelKeyFeaturesAndDescription(pageModel);

  // --- Step 2a: Extract supplementary/fallback data directly from DOM  ---
  const priceElement = Array.from(document.querySelectorAll("span")).find((el) =>
    el?.textContent?.includes("£")
  );
  const locationElement = document.querySelector("h1");
  // Restore original DOM element finding
  const propertyTypeElement = Array.from(document.querySelectorAll("dt")).find((dt) =>
    dt.textContent?.includes("PROPERTY TYPE")
  )?.nextElementSibling;
  const tenureElement = Array.from(document.querySelectorAll("dt")).find((dt) =>
    dt.textContent?.includes("TENURE")
  )?.nextElementSibling;
  const bedroomsElement = Array.from(document.querySelectorAll("dt")).find((dt) =>
    dt.textContent?.includes("BEDROOMS")
  )?.nextElementSibling;
  const bathroomsElement = Array.from(document.querySelectorAll("dt")).find((dt) =>
    dt.textContent?.includes("BATHROOMS")
  )?.nextElementSibling;
  const parkingElement = Array.from(document.querySelectorAll("dt")).find((dt) =>
    dt.textContent?.includes("PARKING")
  )?.nextElementSibling;
  const gardenElement = Array.from(document.querySelectorAll("dt")).find((dt) =>
    dt.textContent?.includes("GARDEN")
  )?.nextElementSibling;
  const councilTaxElement = Array.from(document.querySelectorAll("dt")).find((dt) =>
    dt.textContent?.includes("COUNCIL TAX")
  )?.nextElementSibling;
  const sizeElement = Array.from(document.querySelectorAll("dt")).find((dt) =>
    dt.textContent?.includes("SIZE")
  )?.nextElementSibling;

  // --- Step 2b: Extract Key Features and Full Description using stable anchor ---
  const primaryLayout = document.querySelector('article[data-testid="primary-layout"]');
  let keyFeaturesFromDom: string[] = [];
  let descriptionFromDom = "";
  let epcRatingFromDom: string | undefined = undefined;

  if (primaryLayout) {
    // Find Key Features heading and its sibling UL
    const keyFeaturesHeading = Array.from(primaryLayout.querySelectorAll("h2")).find(
      (h2) => h2.textContent?.trim().toLowerCase() === "key features"
    );
    const keyFeaturesListElement = keyFeaturesHeading?.nextElementSibling;
    if (keyFeaturesListElement instanceof HTMLUListElement) {
      keyFeaturesFromDom = Array.from(keyFeaturesListElement.querySelectorAll("li")).map(
        (li) => li.textContent?.trim() || ""
      );
    }

    // Find Description heading and its sibling DIV
    const descriptionHeading = Array.from(primaryLayout.querySelectorAll("h2")).find(
      (h2) => h2.textContent?.trim().toLowerCase() === "description"
    );
    const descriptionElement = descriptionHeading?.nextElementSibling;
    // Use innerHTML for description to preserve line breaks (<br> tags)
    descriptionFromDom = descriptionElement?.innerHTML?.trim() || "";

    // Extract EPC Rating specifically from the full DOM description text content
    epcRatingFromDom = extractTextWithRegex(
      descriptionElement?.textContent ?? undefined,
      EPC_RATING_REGEX
    )?.toUpperCase();
  } else {
    logErrorToSentry(
      'Could not find primary layout article[data-testid="primary-layout"] for DOM scraping',
      "warning"
    );
    // Fallback to pageModel text if primary layout fails
    descriptionFromDom = pageModel?.propertyData?.text?.description || "";
    keyFeaturesFromDom = pageModel?.propertyData?.keyFeatures || [];
  }

  // --- Step 3: Combine pageModel and DOM data, prioritising where appropriate ---

  // Prioritize EPC from DOM description, fallback to pageModel text extraction
  const finalEpcValue = epcRatingFromDom || epcRatingFromPageModelText;
  const finalEpcConfidence: Confidence = finalEpcValue
    ? epcRatingFromDom
      ? ConfidenceLevels.HIGH // High confidence if found in specific DOM section
      : ConfidenceLevels.MEDIUM // Medium if found in general pageModel text
    : ConfidenceLevels.NONE;
  const finalSource: EpcDataSourceType = finalEpcValue
    ? EpcDataSourceType.LISTING // Assume listing source for now
    : EpcDataSourceType.NONE;

  const epcUrl =
    (pageModel?.propertyData?.epcGraphs?.length ?? 0) > 0 &&
    pageModel?.propertyData?.epcGraphs?.[0]?.url
      ? pageModel?.propertyData?.epcGraphs?.[0]?.url
      : null;

  // Update epcData with potentially more accurate EPC from DOM
  const epcData: EpcData = {
    url: epcUrl,
    automatedProcessingResult: null, // This would be populated by image/PDF processing later
    value: finalEpcValue,
    confidence: finalEpcConfidence,
    source: finalSource,
    error: null,
  };

  // Other pageModel extractions remain largely the same
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

  const salePrice =
    pageModel?.propertyData?.prices?.primaryPrice || priceElement?.textContent?.trim() || null;
  const displayAddress =
    pageModel?.propertyData?.address?.displayAddress ||
    locationElement?.textContent?.trim() ||
    null;
  const address = {
    displayAddress: displayAddress,
    postcode: `${pageModel?.propertyData?.address?.outcode ?? ""} ${pageModel?.propertyData?.address?.incode ?? ""}`,
    isAddressConfirmedByUser: false,
  };

  const {
    priceDiscrepancyValue,
    priceDiscrepancyStatus,
    priceDiscrepancyReason,
    compoundAnnualGrowthRate,
    volatility,
  } = await getPropertySalesInsights(salePrice);
  const isRental = isRentalProperty(pageModel);
  const listingHistory =
    pageModel?.propertyData?.listingHistory?.listingUpdateReason ||
    CHECKLIST_NO_VALUE.NOT_MENTIONED;
  const locationCoordinates = {
    lat: pageModel?.propertyData?.location?.latitude ?? null,
    lng: pageModel?.propertyData?.location?.longitude ?? null,
  };
  const windows = windowsFromUnstructuredText || CHECKLIST_NO_VALUE.NOT_MENTIONED;
  const nearestTrainStations = pageModel?.propertyData?.nearestStations ?? [];
  const nearbySchools = await getNearbySchools();
  const broadbandData = await getBroadbandData();

  // --- Step 4: Construct the final data object using combined sources ---
  const propertyData: ExtractedPropertyScrapingData = {
    // Identifiers and Metadata
    propertyId: pageModel?.propertyData?.id ?? null,
    copyLinkUrl: pageModel?.metadata?.copyLinkUrl ?? null,
    agent: {
      name: pageModel?.propertyData?.customer?.branchDisplayName ?? "",
      contactUrl: pageModel?.metadata?.emailAgentUrl ?? "",
      phoneNumber: phoneNumber,
    },
    address: address,
    locationCoordinates: locationCoordinates,
    isRental,

    // Core Property Details (pageModel > Original DOM Elements > unstructured text)
    propertyType:
      pageModel?.propertyData?.propertySubType || propertyTypeElement?.textContent?.trim() || null,
    tenure:
      pageModel?.propertyData?.tenure?.tenureType || tenureElement?.textContent?.trim() || null,
    bedrooms:
      pageModel?.propertyData?.bedrooms?.toString() || bedroomsElement?.textContent?.trim() || null,
    bathrooms:
      pageModel?.propertyData?.bathrooms?.toString() ||
      bathroomsElement?.textContent?.trim() || // Use original DOM element
      bathroomFromUnstructuredText ||
      null,
    size:
      formatPropertySize(pageModel?.propertyData?.sizings) ||
      sizeElement?.textContent?.trim() ||
      null,
    councilTax:
      pageModel?.propertyData?.livingCosts?.councilTaxBand ||
      councilTaxElement?.textContent?.trim() ||
      null,

    // Features (pageModel > Original DOM Elements > unstructured text)
    parking:
      pageModel?.propertyData?.features?.parking?.[0]?.displayText ||
      parkingElement?.textContent?.trim() ||
      null,
    garden:
      pageModel?.propertyData?.features?.garden?.[0]?.displayText ||
      gardenElement?.textContent?.trim() || // Use original DOM element
      gardenFromUnstructuredText ||
      CHECKLIST_NO_VALUE.NOT_MENTIONED,
    heating:
      pageModel?.propertyData?.features?.heating?.[0]?.displayText ||
      heatingFromUnstructuredText ||
      CHECKLIST_NO_VALUE.NOT_MENTIONED, // No specific DOM element for heating usually
    windows: windows,
    accessibility:
      pageModel?.propertyData?.features?.accessibility
        ?.map((feature: any) => feature?.displayText)
        ?.filter(Boolean)
        .join(", ") ||
      accessibilityFromUnstructuredText ||
      CHECKLIST_NO_VALUE.NOT_MENTIONED,

    epc: epcData,
    // Leasehold Info (from unstructured text extraction)
    leaseTerm: leaseTermFromText || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    groundRent: groundRentFromText || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    serviceCharge: serviceChargeFromText,

    // Risks and Obligations (primarily from pageModel)
    floodedInLastFiveYears:
      pageModel?.propertyData?.features?.risks?.floodedInLastFiveYears ?? null,
    floodDefences: pageModel?.propertyData?.features?.risks?.floodDefences ?? null,
    floodSources: pageModel?.propertyData?.features?.risks?.floodSources ?? null,
    privateRightOfWayObligation:
      pageModel?.propertyData?.features?.obligations?.requiredAccess ?? null,
    publicRightOfWayObligation: mapBooleanToRightOfWayDetails(
      pageModel?.propertyData?.features?.obligations?.rightsOfWay
    ),
    restrictions: pageModel?.propertyData?.features?.obligations?.restrictions ?? null,
    listedProperty: mapScrapedStatusToListedBuildings(listedPropertyFromUnstructuredText),
    buildingSafety: buildingSafetyResultFromUnstructuredText || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    coastalErosion: coastalErosionResultFromUnstructuredText || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    miningImpact: miningImpactPropertyItem || {
      value: CHECKLIST_NO_VALUE.NOT_MENTIONED,
      status: DataStatus.ASK_AGENT,
      reason: "Could not determine mining impact.",
    },
    miningImpactStatus: miningImpactStatus ?? null,

    // Media and History
    floorPlan: floorPlan,
    listingHistory: listingHistory || CHECKLIST_NO_VALUE.NOT_MENTIONED,
    salesHistory: {
      priceDiscrepancy: {
        value: priceDiscrepancyValue,
        status: priceDiscrepancyStatus,
        reason: priceDiscrepancyReason,
      },
      compoundAnnualGrowthRate,
      volatility,
    },

    // Connectivity and Local Area
    broadband: broadbandData,
    nearestStations: nearestTrainStations,
    nearbySchools: nearbySchools,

    // Keep original salePrice field for now, although 'price' is preferred
    salePrice: salePrice,
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
