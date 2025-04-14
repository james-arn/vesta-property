import { getNearbyPlanningApplicationsStatus, getNearbyPlanningApplicationsValue, getPropertyPlanningApplicationsStatus, getPropertyPlanningApplicationsValue } from "@/components/ui/Premium/PlanningPermission/helpers";
import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { PropertyGroups } from "@/constants/propertyConsts";
import { volatilityThreshold } from "@/constants/thresholds";
import { CrimeScoreData, getCrimeScoreStatus, getCrimeScoreValue } from "@/hooks/useCrimeScore";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { PremiumStreetDataResponse } from "@/types/premiumStreetData";
import { capitaliseFirstLetterAndCleanString } from "@/utils/text";
import { UseQueryResult } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import {
  DataStatus,
  ExtractedPropertyScrapingData,
  PropertyDataListItem
} from "../../types/property";
import {
  calculateListingHistoryDetails,
  calculateRemainingLeaseTerm,
  determineEpcChecklistItemDetails,
  getCAGRStatus,
  getStatusFromBoolean,
  getVolatilityStatus,
  getYesNoOrAskAgentStringFromBoolean,
  getYesNoOrMissingStatus,
  priceDiscrepancyMessages
} from "./helpers";

export const agentMissingInfo = CHECKLIST_NO_VALUE.NOT_MENTIONED;
const askAgentWrittenByAgent = "ask agent";

// Helper to determine status for a string-based property
export function getStatusFromString(
  value: string | null,
  additionalInvalids: string[] = []
): DataStatus {
  if (!value) return DataStatus.ASK_AGENT;
  const lowerValue = value.trim().toLowerCase();
  // Any value that is "not mentioned", "ask agent", or any others passed in is considered invalid
  const invalidValues = [agentMissingInfo, askAgentWrittenByAgent, ...additionalInvalids];
  if (invalidValues.includes(lowerValue)) {
    return DataStatus.ASK_AGENT;
  }
  return DataStatus.FOUND_POSITIVE;
}

const BROADBAND_SPEED_UNDER_10MBS_REGEX = /\b(\d{1,2})\s*mbs\b/i;

export function generatePropertyChecklist(
  propertyData: ExtractedPropertyScrapingData,
  crimeScoreQuery: UseQueryResult<CrimeScoreData, Error> | undefined,
  premiumStreetDataQuery: UseQueryResult<PremiumStreetDataResponse, Error> | undefined,
  epcResult: EpcProcessorResult
): PropertyDataListItem[] {
  if (!propertyData) {
    console.error('No property data provided to generatePropertyChecklist');
    return [];
  }

  const { status: listingHistoryStatus, value: listingHistoryValue } =
    calculateListingHistoryDetails(propertyData.listingHistory);

  const crimeScoreData = crimeScoreQuery?.data;
  const isCrimeScoreLoading = crimeScoreQuery?.isLoading ?? false;
  const crimeScoreError = crimeScoreQuery?.error;

  const premiumStreetData = premiumStreetDataQuery?.data?.data;
  const isPremiumStreetDataLoading = premiumStreetDataQuery?.isLoading ?? false;
  const premiumStreetDataError = premiumStreetDataQuery?.error;
  const premiumLeaseDetails = premiumStreetData?.attributes.tenure?.lease_details;
  const premiumLeaseEndDate = premiumLeaseDetails?.calculated_end_of_lease;
  const hasFetchedPremiumLease = premiumStreetDataQuery?.isSuccess && !!premiumLeaseEndDate;
  const { formatted: premiumFormattedLeaseTerm } =
    calculateRemainingLeaseTerm(premiumLeaseEndDate);

  const epcChecklistItem = determineEpcChecklistItemDetails(
    propertyData.epc,
    epcResult
  );

  // note - dashboard group is grouped in dashboardConsts map to seperate concerns.
  const checklist: PropertyDataListItem[] = [
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Price",
      key: "price",
      status: getStatusFromString(propertyData.salePrice),
      value: propertyData.salePrice,
      askAgentMessage: "What's the price?",
      toolTipExplainer:
        "Knowing the purchase price means you can work out the total cost of buying the property.\n\n" +
        "Not only mortgage payments and deposit, but also any stamp duty, legal and moving costs.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Tenure",
      key: "tenure",
      status: getStatusFromString(propertyData.tenure),
      value: capitaliseFirstLetterAndCleanString(propertyData.tenure ?? ""),
      askAgentMessage: "What's the tenure?",
      toolTipExplainer:
        "Tenure determines how you legally own the property and any associated costs or obligations.\n\n" +
        "Types include Freehold, Leasehold, Commonhold, Shared Ownership, and Non-traditional Tenure.\n\n" +
        "Each tenure type has different responsibilities, rights, and costs associated with it.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Location",
      key: "location",
      status: getStatusFromString(propertyData.address.displayAddress),
      value: propertyData.address.displayAddress,
      askAgentMessage: "Where's the property located?",
      toolTipExplainer:
        "Location is a critical factor in property valuation and desirability.\n\n" +
        "It affects accessibility to amenities, schools, and transport links, and can influence the property's future value.\n\n" +
        "A prime location can enhance lifestyle and convenience, while also impacting safety and community engagement.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Property Type",
      key: "propertyType",
      status: getStatusFromString(propertyData.propertyType),
      value: propertyData.propertyType,
      askAgentMessage: "What's the property type?",
      toolTipExplainer:
        "Property type refers to the category of the property, such as residential, commercial, or mixed-use.\n\n" +
        "It can also include specific types like flats, houses, or apartments.\n\n" +
        "Understanding the property type helps in assessing its value, potential use, and market demand.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Accessibility",
      key: "accessibility",
      status: getStatusFromString(propertyData.accessibility),
      value: propertyData.accessibility,
      askAgentMessage: "Is the property accessible-friendly?",
      toolTipExplainer:
        "Accessibility features make the property suitable for people with mobility needs.\n\n" +
        "Common accessible features include level access, lift access, ramped access, wet rooms, wide doorways, step-free access, level access showers, and lateral living (a property where all key rooms are on the entry level).",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Listing history",
      key: "listingHistory",
      status: listingHistoryStatus,
      value: listingHistoryValue,
      askAgentMessage: "What's the listing history?",
      toolTipExplainer:
        "Listing history provides insights into the property's market activity, such as price changes and time on the market.\n\n" +
        "This can indicate whether the property has been difficult to sell or if it has had price reductions.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Occupancy Status",
      key: "occupancyStatus",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Indicates if the property is currently owner-occupied or rented out.\n\n" +
        "This can affect availability for viewing and moving in, and potentially indicate property condition based on tenure history.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },

    // Investment Potential
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Price Change from last sale",
      key: "priceDiscrepancy",
      status:
        propertyData.salesHistory.priceDiscrepancy.status ?? DataStatus.ASK_AGENT,
      value: propertyData.salesHistory.priceDiscrepancy.value,
      askAgentMessage:
        priceDiscrepancyMessages[
          propertyData.salesHistory.priceDiscrepancy.reason ?? ""
        ]?.askAgentMessage || "",
      toolTipExplainer:
        priceDiscrepancyMessages[
          propertyData.salesHistory.priceDiscrepancy.reason ?? ""
        ]?.toolTipExplainer ||
        "This metric shows the percentage change between the current listing price and the last sold price, " +
        "adjusted for the time span between these transactions. It helps determine whether the price is aligned with historical market trends.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Historical Compound Annual Growth Rate (CAGR)",
      key: "compoundAnnualGrowthRate",
      status: getCAGRStatus(propertyData.salesHistory.compoundAnnualGrowthRate),
      value:
        propertyData.salesHistory.compoundAnnualGrowthRate !== null &&
          typeof propertyData.salesHistory.compoundAnnualGrowthRate === "number"
          ? `${(propertyData.salesHistory.compoundAnnualGrowthRate * 100).toFixed(2)}%`
          : "N/A",
      askAgentMessage: (() => {
        const cagr = propertyData.salesHistory.compoundAnnualGrowthRate;
        if (cagr === null || typeof cagr !== "number") {
          return "";
        }
        if (cagr < 0.03) {
          return "The historical growth rate appears low compared to market expectations. Is there reasons as to why the property underperformed historically?";
        }
        return "";
      })(),
      toolTipExplainer:
        "The CAGR represents the average yearly increase in the property's historical sale values (excluding the current listing). \n\n" +
        "A CAGR below 3% indicates that the property has underperformed historically." +
        (propertyData.salesHistory.compoundAnnualGrowthRate === null
          ? "\n\nIt is N/A as there is no sales history."
          : ""),
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Volatility",
      key: "volatility",
      status: getVolatilityStatus(
        propertyData.salesHistory.volatility,
        volatilityThreshold
      ),
      value: propertyData.salesHistory.volatility,
      askAgentMessage: (() => {
        const volStr = propertyData.salesHistory.volatility;
        if (!volStr || volStr === "N/A") {
          return "";
        }
        const volatilityNumber = parseFloat(volStr.replace("%", ""));
        if (!isNaN(volatilityNumber) && volatilityNumber > volatilityThreshold) {
          return "The price history for this property shows significant fluctuations. Is there a reason for these variations?";
        }
        return "";
      })(),
      toolTipExplainer:
        "Volatility measures the degree of fluctuation in the property's sale price changes over time by calculating the standard deviation of the percentage changes between consecutive sales.\n\n" +
        "A value below 10% generally indicates stable, consistent price changes, while a value above 10% suggests greater variability. \n\n" +
        "This 10% threshold is set as a benchmark for normal fluctuations in a stable market. \n\n" +
        "Keep in mind that with only a few data points available, this metric might not be fully representative and could display as 'N/A'.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Estimated Sale Value",
      key: "estimatedSaleValue",
      status: DataStatus.ASK_AGENT,
      value: premiumStreetData?.attributes.estimated_values?.[0]?.estimated_market_value_rounded ?? "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "An automated valuation model (AVM) estimate of the property's current market value.\n\n" +
        "Useful as a benchmark against the asking price, but accuracy can vary based on data availability and property uniqueness.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Estimated Rental Value",
      key: "estimatedRentalValue",
      status: DataStatus.ASK_AGENT,
      value: premiumStreetData?.attributes.estimated_rental_value?.estimated_monthly_rental_value ?? "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "An estimate of the potential monthly rent the property could achieve in the current market.\n\n" +
        "Important for buy-to-let investors to assess potential income and returns.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Estimated Annual Rental Yield",
      key: "estimatedAnnualRentalYield",
      status: DataStatus.ASK_AGENT,
      value: premiumStreetData?.attributes.estimated_rental_value?.estimated_annual_rental_yield ?? "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Calculates the potential annual rental income as a percentage of the property's estimated value.\n\n" +
        "A key metric for investors comparing the profitability of different property investments.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Propensity To Sell",
      key: "propensityToSell",
      status: DataStatus.ASK_AGENT,
      value: premiumStreetData?.attributes.propensity_to_sell_score ?? "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "An indicator of how likely similar properties in the area are to be listed for sale.\n\n" +
        "Can reflect market liquidity and potential competition or availability.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Propensity To Let",
      key: "propensityToLet",
      status: DataStatus.ASK_AGENT,
      value: premiumStreetData?.attributes.propensity_to_let_score ?? "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "An indicator of the likelihood that similar properties in the area are listed for rent.\n\n" +
        "Reflects the strength of the local rental market and potential for buy-to-let investment.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    // TODO: Revist these in later release
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Outcode Average Sales Price",
      key: "outcodeAvgSalesPrice",
      status: DataStatus.ASK_AGENT,
      value: premiumStreetData?.attributes.market_statistics?.outcode?.average_price_properties_sold_last_12_months ?? "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "The average price properties sold for within the outcode over a recent period.\n\n" +
        "Provides a general benchmark for property values in the area.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    // {
    //   checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
    //   label: "Local Outcode Price Trends (12m Avg)",
    //   key: "outcodePriceTrend12mAvg",
    //   status: DataStatus.ASK_AGENT,
    //   value: "Not Available",
    //   askAgentMessage: "",
    //   toolTipExplainer:
    //     "Provides the average price trend over the last 12 months for the property's outcode.\n\n" +
    //     "Offers a smoother view of market performance compared to potentially volatile shorter-term trends.",
    //   isUnlockedWithPremium: true,
    //   isBoostedWithPremium: false,
    // },
    // {
    //   checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
    //   label: "Yearly Sales Volume",
    //   key: "yearlySalesVolume",
    //   status: DataStatus.ASK_AGENT,
    //   value: "Not Available",
    //   askAgentMessage: "",
    //   toolTipExplainer:
    //     "Indicates the number of properties sold annually in the area.\n\n" +
    //     "High volume can suggest a dynamic market, while low volume might indicate stability or lower demand.",
    //   isUnlockedWithPremium: true,
    //   isBoostedWithPremium: false,
    // },
    // {
    //   checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
    //   label: "Nearby Sales Listings",
    //   key: "nearbySalesListings",
    //   status: DataStatus.ASK_AGENT,
    //   value: "Not Available",
    //   askAgentMessage: "",
    //   toolTipExplainer:
    //     "Information on comparable properties currently listed for sale nearby.\n\n" +
    //     "Helps gauge competition, current market pricing, and relative value of the subject property.",
    //   isUnlockedWithPremium: true,
    //   isBoostedWithPremium: false,
    // },
    // {
    //   checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
    //   label: "Nearby Rental Listings",
    //   key: "nearbyRentalListings",
    //   status: DataStatus.ASK_AGENT,
    //   value: "Not Available",
    //   askAgentMessage: "",
    //   toolTipExplainer:
    //     "Details of comparable properties currently available for rent in the vicinity.\n\n" +
    //     "Provides context for expected rental income and demand if considering letting the property.",
    //   isUnlockedWithPremium: true,
    //   isBoostedWithPremium: false,
    // },
    // {
    //   checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
    //   label: "Nearby Completed Sales",
    //   key: "nearbyCompletedSales",
    //   status: DataStatus.ASK_AGENT,
    //   value: "Not Available",
    //   askAgentMessage: "",
    //   toolTipExplainer:
    //     "Data on recent actual sale prices of comparable properties in the local area.\n\n" +
    //     "Crucial for accurately assessing market value and supporting offer negotiations.",
    //   isUnlockedWithPremium: true,
    //   isBoostedWithPremium: false,
    // },
    // {
    //   checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
    //   label: "Outcode Sales Volume",
    //   key: "outcodeSalesVolume",
    //   status: DataStatus.ASK_AGENT,
    //   value: "Not Available",
    //   askAgentMessage: "",
    //   toolTipExplainer:
    //     "Total number of property sales within the broader postcode area (outcode) over a recent period.\n\n" +
    //     "Indicates the overall activity level and liquidity of the local market.",
    //   isUnlockedWithPremium: true,
    //   isBoostedWithPremium: false,
    // },

    epcChecklistItem,

    // Interior Details
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Bedrooms",
      key: "bedrooms",
      status: propertyData.bedrooms
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: propertyData.bedrooms,
      askAgentMessage: "How many bedrooms?",
      toolTipExplainer:
        "The number of bedrooms in a property is a key factor in its desirability and value.\n\n" +
        "More bedrooms generally indicate a larger living space, which can be more valuable in the housing market.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Bathrooms",
      key: "bathrooms",
      status: propertyData.bathrooms
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: propertyData.bathrooms,
      askAgentMessage: "How many bathrooms?",
      toolTipExplainer:
        "The number of bathrooms in a property is a key factor in its desirability and value.\n\n" +
        "More bathrooms generally indicate a larger living space, which can be more valuable in the housing market.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Heating Type",
      key: "heatingType",
      status: getStatusFromString(propertyData.heating),
      value: propertyData.heating,
      askAgentMessage: "What's the heating type?",
      toolTipExplainer:
        "Heating type refers to the method of heating used in the property, such as gas central heating, electric heating, or underfloor heating.\n\n" +
        "It can also include specific types like boilers, radiators, or heat pumps.\n\n" +
        "Understanding the heating type helps in assessing the property's energy efficiency and comfort.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: true,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Size",
      key: "size",
      status: getStatusFromString(propertyData.size),
      value: propertyData.size,
      askAgentMessage: "What's the size?",
      toolTipExplainer:
        "The size of a property refers to the total area of the property, including all habitable rooms and spaces.\n\n" +
        "It is a key factor in determining the property's value, as larger properties generally have higher value.\n\n" +
        "Size can also impact the property's energy efficiency and maintenance costs.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Floor Plan",
      key: "floorPlan",
      status: getStatusFromString(propertyData.floorPlan),
      value: DOMPurify.sanitize(propertyData.floorPlan ?? ""),
      askAgentMessage: "Do you have a floor plan?",
      toolTipExplainer:
        "A floor plan is a detailed layout of the property's interior spaces, including rooms, hallways, and other features.\n\n" +
        "It provides a visual representation of the property's layout and can be useful for understanding the property's size, layout, and potential for renovation or extension.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Construction Materials",
      key: "constructionMaterials",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "The primary materials used to build the property (e.g., brick, timber frame, concrete).\n\n" +
        "Affects insulation, maintenance requirements, longevity, and potentially mortgageability or insurance.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Construction Age Band",
      key: "constructionAgeBand",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "The approximate period when the property was built (e.g., pre-1900, 1950s, 2000s).\n\n" +
        "Influences architectural style, potential need for renovations, energy efficiency, and presence of period features.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.EXTERIOR,
      label: "Garden",
      key: "garden",
      status: getYesNoOrMissingStatus(propertyData.garden),
      value: propertyData.garden ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: "Is there a garden?",
      toolTipExplainer:
        "A garden is a private outdoor space associated with a property, providing a place for relaxation, entertainment, and gardening.\n\n" +
        "It can range from a small patio or balcony to a large garden with various features like lawns, trees, and outdoor living areas.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.EXTERIOR,
      label: "Windows",
      key: "windows",
      status:
        typeof propertyData.windows === "string" &&
          propertyData.windows.toLowerCase() !== agentMissingInfo
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value: propertyData.windows,
      askAgentMessage: "Windows - material & glazing?",
      toolTipExplainer:
        "The key information to know is the materials, such as wood, aluminium, or uPVC, and the glazing, such as single or double-glazed windows.\n\n" +
        "Understanding the window material and glazing can impact the property's energy efficiency and comfort.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: true,
    },
    {
      checklistGroup: PropertyGroups.EXTERIOR,
      label: "Parking",
      key: "parking",
      status: getYesNoOrMissingStatus(propertyData.parking),
      value: propertyData.parking ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: "Is there parking?",
      toolTipExplainer:
        "Parking can refer to how and where vehicles can be parked, and any associated costs.\n\n" +
        "Factors to consider include whether a parking space is owned by you, if parking is communal, or if a permit is needed.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Listed property",
      key: "listedProperty",
      status: propertyData.listedProperty.status ?? DataStatus.ASK_AGENT,
      value: propertyData.listedProperty.value ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: propertyData.listedProperty.reason ?? "",
      toolTipExplainer:
        "A listed property is designated as being of architectural or historical interest and requires special permission before being altered.\n\n" +
        "There are three grades of listed buildings: Grade I (exceptional interest), Grade II (special interest, most common for homes), and Grade II* (national importance).",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Restrictions",
      key: "restrictions",
      status: getStatusFromBoolean(propertyData.restrictions, true),
      value: getYesNoOrAskAgentStringFromBoolean(propertyData.restrictions),
      askAgentMessage: "Any restrictions?",
      toolTipExplainer:
        "Restrictions are legal constraints on what can be done with the property, such as building height limits, conservation area regulations, or planning permissions.\n\n" +
        "These restrictions can impact the property's value and potential use.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Public right of way obligation",
      key: "publicRightOfWayObligation",
      status: getStatusFromBoolean(propertyData.publicRightOfWayObligation, true),
      value: getYesNoOrAskAgentStringFromBoolean(
        propertyData.publicRightOfWayObligation
      ),
      askAgentMessage: "Public right of way obligation?",
      toolTipExplainer:
        "Public Rights of Way are legal obligations requiring access to private property, such as footpaths or bridleways.\n\n" +
        "Property owners may be responsible for upkeep and work with the council for maintenance.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Private right of way obligation",
      key: "privateRightOfWayObligation",
      status: getStatusFromBoolean(propertyData.privateRightOfWayObligation, true),
      value: getYesNoOrAskAgentStringFromBoolean(
        propertyData.privateRightOfWayObligation
      ),
      askAgentMessage: "Private right of way obligation?",
      toolTipExplainer:
        "Private Rights of Way allow individuals or companies to access or alter land without requiring permission.\n\n" +
        "Examples include access rights for neighbouring properties or utility companies installing infrastructure.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Ground Rent",
      key: "groundRent",
      status:
        propertyData.tenure?.toLowerCase() === "leasehold"
          ? getStatusFromString(propertyData.groundRent)
          : DataStatus.NOT_APPLICABLE,
      value:
        propertyData.tenure?.toLowerCase() === "leasehold"
          ? propertyData.groundRent
          : CHECKLIST_NO_VALUE.NOT_APPLICABLE,
      askAgentMessage: "What is the ground rent per annum?",
      toolTipExplainer:
        "An annual fee paid by leaseholders to the freeholder for the use of the land the property sits on.\n\n" +
        "Check the amount, review schedule, and terms, as high or escalating ground rents can be problematic.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Service Charge",
      key: "serviceCharge",
      status:
        propertyData.tenure?.toLowerCase() === "leasehold"
          ? getStatusFromString(propertyData.serviceCharge)
          : DataStatus.NOT_APPLICABLE,
      value:
        propertyData.tenure?.toLowerCase() === "leasehold"
          ? propertyData.serviceCharge
          : CHECKLIST_NO_VALUE.NOT_APPLICABLE,
      askAgentMessage: "What is the service charge per annum?",
      toolTipExplainer:
        "A fee paid by leaseholders (usually flats) for the upkeep of communal areas and services.\n\n" +
        "Review what it covers, historical costs, and any planned major works that could increase future charges.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Remaining Lease Term",
      key: "remainingLeaseTerm",
      status:
        hasFetchedPremiumLease ? DataStatus.FOUND_POSITIVE :
          isPremiumStreetDataLoading ? DataStatus.IS_LOADING :
            getStatusFromString(propertyData.leaseTerm),
      value: (() => {
        if (hasFetchedPremiumLease) {
          return premiumFormattedLeaseTerm;
        }

        const leaseTermStatus = getStatusFromString(propertyData.leaseTerm);
        if (leaseTermStatus !== DataStatus.ASK_AGENT) {
          return propertyData.leaseTerm;
        }

        return CHECKLIST_NO_VALUE.NOT_MENTIONED;
      })(),
      askAgentMessage: "What is the remaining term on the lease?",
      toolTipExplainer:
        "The number of years left on a leasehold agreement.\n\n" +
        "Leases under 80 years can become expensive to extend and may affect mortgage availability and resale value.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: true,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Title Deed Issues",
      key: "titleDeedIssues",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Potential problems found within the property's legal title documents.\n\n" +
        "Could include boundary disputes, unclear ownership, or restrictive covenants impacting property use or modifications.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Conservation Area Status",
      key: "conservationAreaStatus",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Indicates if the property is located within an area designated for preservation due to special architectural or historic interest.\n\n" +
        "This often means stricter planning controls on alterations, extensions, and even minor changes like window replacements.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Crime Score",
      key: "crimeScore",
      status: getCrimeScoreStatus(isCrimeScoreLoading, crimeScoreData),
      value: getCrimeScoreValue(isCrimeScoreLoading, crimeScoreData, crimeScoreError),
      askAgentMessage: "Do you have any insights into the safety of the neighbourhood?",
      toolTipExplainer: "This metric provides insights into the safety of the location within a 1 mile radius over the last 6 months, based on public crime data from official sources and scored by our proprietary algorithm.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Flood Defences",
      key: "floodDefences",
      status: getStatusFromBoolean(propertyData.floodDefences),
      value: getYesNoOrAskAgentStringFromBoolean(propertyData.floodDefences),
      askAgentMessage: "Any flood defences?",
      toolTipExplainer:
        "Flood defences help protect the property from water damage.\n\n" +
        "It's important to check if the property is at risk of flooding or has a history of flooding, as this can impact insurance and value.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Flood Sources",
      key: "floodSources",
      status:
        (propertyData.floodSources ?? []).length > 0
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value:
        (propertyData.floodSources ?? []).length > 0
          ? (propertyData.floodSources?.join(", ") ?? CHECKLIST_NO_VALUE.NOT_MENTIONED)
          : CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: "Any flood sources?",
      toolTipExplainer:
        "Flood sources are the natural or man-made features that contribute to flooding, such as rivers, streams, dams, or levees.\n\n" +
        "Understanding the flood sources can help assess the property's risk of flooding and the effectiveness of flood defences.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Flooded in last 5 years",
      key: "floodedInLastFiveYears",
      status: getStatusFromBoolean(propertyData.floodedInLastFiveYears, true),
      value: getYesNoOrAskAgentStringFromBoolean(
        propertyData.floodedInLastFiveYears
      ),
      askAgentMessage: "Flooded in last 5 years?",
      toolTipExplainer:
        "A history of flooding can impact property value and insurance.\n\n" +
        "Buyers should check for any past flooding incidents and existing flood defences.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Building Safety",
      key: "buildingSafety",
      status: propertyData.buildingSafety.status ?? DataStatus.ASK_AGENT,
      value: propertyData.buildingSafety.value ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: propertyData.buildingSafety.reason ?? "",
      toolTipExplainer:
        "This item identifies building safety information by scanning for key terms. " +
        "Positive terms such as 'Fire Alarm System' indicate robust safety measures, while negative terms (e.g. 'Mould') " +
        "may flag potential concerns. The absence of any mention means further clarification might be needed.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Coastal Erosion",
      key: "coastalErosion",
      status: propertyData.coastalErosion.status ?? DataStatus.ASK_AGENT,
      value: propertyData.coastalErosion.value ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: propertyData.coastalErosion.reason ?? "",
      toolTipExplainer:
        "Coastal erosion isn't mentioned in the listing. This could mean the property isn't in a coastal area—or it might be an omission. Please confirm if there's any coastal risk.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Mining Impact",
      key: "miningImpact",
      status: propertyData.miningImpact.status ?? DataStatus.ASK_AGENT,
      value: propertyData.miningImpact.value ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: propertyData.miningImpact.reason ?? "",
      toolTipExplainer:
        "Mining impact refers to the impact of mining on the property and the surrounding area.\n\n" +
        "It's important to check the mining impact to ensure the property is not at risk of mining subsidence or other mining-related risks.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Detailed Flood Risk Assessment",
      key: "detailedFloodRiskAssessment",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "A comprehensive report assessing the property's specific flood risk from rivers, sea, surface water, and groundwater.\n\n" +
        "Provides more detail than basic checks, crucial for insurance and understanding potential mitigation needs.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Airport Noise Assessment",
      key: "airportNoiseAssessment",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Evaluates the level of noise pollution from nearby airports and flight paths.\n\n" +
        "Significant noise can impact quality of life and potentially property value.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "National Park Proximity",
      key: "nationalParkProximity",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Indicates if the property is located near or within a designated National Park boundary.\n\n" +
        "Proximity offers recreational benefits but may also come with stricter planning regulations.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Police Force Proximity",
      key: "policeForceProximity",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Information about the nearest police station and local policing team presence.\n\n" +
        "Can be relevant for understanding community safety resources and response times.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },

    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Council Tax Band",
      key: "councilTax",
      status: getStatusFromString(propertyData.councilTax, ["tbc"]),
      value: propertyData.councilTax,
      askAgentMessage: "What council tax band?",
      toolTipExplainer:
        "Council tax is a payment to the local authority for services like schools and waste collection.\n\n" +
        "Council tax bands are based on property value, and some exemptions apply (e.g., students).",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Broadband",
      key: "broadband",
      status: propertyData.broadband
        ? (() => {
          const match = propertyData.broadband.match(
            BROADBAND_SPEED_UNDER_10MBS_REGEX
          );
          return match && parseInt(match[1]) <= 10
            ? DataStatus.ASK_AGENT
            : DataStatus.FOUND_POSITIVE;
        })()
        : DataStatus.ASK_AGENT,
      value: propertyData.broadband,
      askAgentMessage: "How's the broadband speed?",
      toolTipExplainer:
        "Broadband speed refers to the speed of internet connection, measured in megabits per second (Mbps).\n\n" +
        "Faster speeds provide better internet connectivity, allowing for faster downloads, streaming, and online activities.\n\n" +
        "It's important to check the broadband speed to ensure it meets your needs, especially for work, streaming, and gaming.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Mobile Service Coverage",
      key: "mobileServiceCoverage",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Information on the signal strength and availability of major mobile network providers at the property.\n\n" +
        "Crucial for reliable communication, especially if working from home or in areas with poor reception.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Property Planning Permissions",
      key: "planningPermissions",
      status: getPropertyPlanningApplicationsStatus(
        premiumStreetData?.attributes.planning_applications,
      ),
      value: getPropertyPlanningApplicationsValue(premiumStreetData?.attributes.planning_applications),
      askAgentMessage: "I noticed there are quite a few planning permissions on the property. Do you have more information on this?",
      toolTipExplainer:
        "Planning permission is a key aspect of property regulation in the UK.\n\n" +
        "It typically applies to the specific property and its immediate surroundings, ensuring that any proposed alterations or developments align with local council guidelines.\n\n" +
        "Reviewing the planning permission history can reveal existing restrictions or opportunities for future renovations, which is crucial information when buying a property. ",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Nearby Planning Permissions",
      key: "nearbyPlanningPermissions",
      status: getNearbyPlanningApplicationsStatus(
        premiumStreetData?.attributes.nearby_planning_applications,
      ),
      value: getNearbyPlanningApplicationsValue(premiumStreetData?.attributes.nearby_planning_applications),
      askAgentMessage: "I noticed there are quite a few planning permissions on property nearby. Is there anything I should know about this?",
      toolTipExplainer:
        "Planning permission is a key aspect of property regulation in the UK.\n\n" +
        "It typically applies to the specific property and its immediate surroundings, ensuring that any proposed alterations or developments align with local council guidelines.\n\n" +
        "Reviewing the planning permission history can reveal existing restrictions or opportunities for future renovations, which is crucial information when buying a property. ",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "Healthcare Proximity",
      key: "healthcareProximity",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Details on the distance and accessibility of nearby GP surgeries, hospitals, and other healthcare facilities.\n\n" +
        "Essential for assessing convenience and access to medical care.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "Train Station Proximity",
      key: "trainStationProximity",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Details on the distance and accessibility of nearby train stations.\n\n" +
        "Essential for assessing convenience and access to public transport.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: true,
    },
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "School Proximity",
      key: "schoolProximity",
      status: DataStatus.ASK_AGENT,
      value: "Not Available",
      askAgentMessage: "",
      toolTipExplainer:
        "Details on the distance and accessibility of nearby schools.\n\n" +
        "Essential for assessing convenience and access to education.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: true,
    },
  ];

  // Filter out items not applicable based on property type (e.g., councilTax for non-residential)
  // This filtering logic might need adjustment depending on exact requirements
  const filteredChecklist = checklist.filter(item => {
    if (!item) return false;

    if (item.key === 'councilTax' && propertyData.propertyType === 'Commercial') {
      return false; // Example: Don't show council tax for commercial
    }
    // Add other filtering logic as needed
    return true;
  });

  return filteredChecklist;
}
