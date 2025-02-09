import {
  extractInfoFromPageModelKeyFeaturesAndDescription,
  formatPropertySize,
  getBroadbandInfo,
} from "@/contentScript/utils/propertyScrapeHelpers";
import { ExtractedPropertyData } from "@/types/property";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import getPropertySalesInsights from "./propertySalesInsights";

export async function extractPropertyDataFromDOM(
  pageModel: RightmovePageModelType | null
): Promise<ExtractedPropertyData> {
  if (!pageModel) console.error("No page model available, attempting data only from DOM");

  // Page model extraction
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

  return {
    agent: {
      name: pageModel?.propertyData?.customer?.branchDisplayName ?? "",
      contactUrl: pageModel?.metadata?.emailAgentUrl ?? "",
      phoneNumber: phoneNumber,
    },
    copyLinkUrl: pageModel?.metadata?.copyLinkUrl ?? null,
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
    location:
      pageModel?.propertyData?.address?.displayAddress ||
      locationElement?.textContent?.trim() ||
      null,
    propertyType: pageModel?.propertyData?.propertySubType || propertyTypeElement || null,
    tenure: pageModel?.propertyData?.tenure?.tenureType || tenureElement || null,
    bedrooms: pageModel?.propertyData?.bedrooms?.toString() || bedroomsElement || null,
    bathrooms: pageModel?.propertyData?.bathrooms?.toString() || bathroomsElement || null,
    parking: pageModel?.propertyData?.features?.parking?.[0]?.displayText || parkingElement || null,
    garden:
      pageModel?.propertyData?.features?.garden?.[0]?.displayText ||
      gardenFromUnstructuredText ||
      "Ask agent",
    councilTax: pageModel?.propertyData?.livingCosts?.councilTaxBand || councilTaxElement || null,
    size: formatPropertySize(pageModel?.propertyData?.sizings) || sizeElement || null,
    heating:
      pageModel?.propertyData?.features?.heating?.[0]?.displayText ||
      heatingFromUnstructuredText ||
      "Ask agent",
    floorPlan: floorPlan,

    epc: epc,
    broadband: getBroadbandInfo(pageModel),
    listingHistory: pageModel?.propertyData?.listingHistory?.listingUpdateReason || "Ask agent",
    windows: windowsFromUnstructuredText || "Ask agent",
    publicRightOfWayObligation: pageModel?.propertyData?.features?.obligations?.rightsOfWay ?? null,
    privateRightOfWayObligation:
      pageModel?.propertyData?.features?.obligations?.requiredAccess ?? null,
    listedProperty: pageModel?.propertyData?.features?.obligations?.listed ?? null,

    restrictions: pageModel?.propertyData?.features?.obligations?.restrictions ?? null,
    floodDefences: pageModel?.propertyData?.features?.risks?.floodDefences ?? null,
    floodSources: pageModel?.propertyData?.features?.risks?.floodSources ?? null,
    floodedInLastFiveYears:
      pageModel?.propertyData?.features?.risks?.floodedInLastFiveYears ?? null,
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
