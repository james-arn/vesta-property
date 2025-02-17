import { volatilityThreshold } from "@/constants/thresholds";
import { CrimeScoreData, getCrimeScoreStatus, getCrimeScoreValue } from "@/hooks/useCrimeScore";
import { capitaliseFirstLetterAndCleanString } from "@/utils/text";
import { UseQueryResult } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import {
  DataStatus,
  ExtractedPropertyScrapingData,
  PropertyDataList,
  PropertyGroups,
} from "../../types/property";
import {
  calculateListingHistoryDetails,
  getStatusFromBoolean,
  getYesNoOrAskAgentStringFromBoolean,
  getYesNoOrMissingStatus,
  priceDiscrepancyMessages,
} from "./helpers";

export const agentMissingInfo = "not mentioned";
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
  ExtractedPropertyScrapingData: ExtractedPropertyScrapingData,
  crimeScoreQuery: UseQueryResult<CrimeScoreData, Error> | undefined
): PropertyDataList[] {
  const { status: listingHistoryStatus, value: listingHistoryValue } =
    calculateListingHistoryDetails(ExtractedPropertyScrapingData.listingHistory);

  const crimeScoreData = crimeScoreQuery?.data;
  const isCrimeScoreLoading = crimeScoreQuery?.isLoading ?? false;
  const crimeScoreError = crimeScoreQuery?.error;

  const checklist: PropertyDataList[] = [
    {
      group: PropertyGroups.GENERAL,
      label: "Price",
      key: "price",
      status: getStatusFromString(ExtractedPropertyScrapingData.salePrice),
      value: ExtractedPropertyScrapingData.salePrice,
      askAgentMessage: "What's the price?",
      toolTipExplainer:
        "Knowing the purchase price means you can work out the total cost of buying the property.\n\n" +
        "Not only mortgage payments and deposit, but also any stamp duty, legal and moving costs.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Tenure",
      key: "tenure",
      status: getStatusFromString(ExtractedPropertyScrapingData.tenure),
      value: capitaliseFirstLetterAndCleanString(ExtractedPropertyScrapingData.tenure ?? ""),
      askAgentMessage: "What's the tenure?",
      toolTipExplainer:
        "Tenure determines how you legally own the property and any associated costs or obligations.\n\n" +
        "Types include Freehold, Leasehold, Commonhold, Shared Ownership, and Non-traditional Tenure.\n\n" +
        "Each tenure type has different responsibilities, rights, and costs associated with it.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Location",
      key: "location",
      status: getStatusFromString(ExtractedPropertyScrapingData.location),
      value: ExtractedPropertyScrapingData.location,
      askAgentMessage: "Where's the property located?",
      toolTipExplainer:
        "Location is a critical factor in property valuation and desirability.\n\n" +
        "It affects accessibility to amenities, schools, and transport links, and can influence the property's future value.\n\n" +
        "A prime location can enhance lifestyle and convenience, while also impacting safety and community engagement.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Property Type",
      key: "propertyType",
      status: getStatusFromString(ExtractedPropertyScrapingData.propertyType),
      value: ExtractedPropertyScrapingData.propertyType,
      askAgentMessage: "What's the property type?",
      toolTipExplainer:
        "Property type refers to the category of the property, such as residential, commercial, or mixed-use.\n\n" +
        "It can also include specific types like flats, houses, or apartments.\n\n" +
        "Understanding the property type helps in assessing its value, potential use, and market demand.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Accessibility",
      key: "accessibility",
      status: getStatusFromString(ExtractedPropertyScrapingData.accessibility),
      value: ExtractedPropertyScrapingData.accessibility,
      askAgentMessage: "Is the property accessible-friendly?",
      toolTipExplainer:
        "Accessibility features make the property suitable for people with mobility needs.\n\n" +
        "Common accessible features include level access, lift access, ramped access, wet rooms, wide doorways, step-free access, level access showers, and lateral living (a property where all key rooms are on the entry level).",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Listing history",
      key: "listingHistory",
      status: listingHistoryStatus,
      value: listingHistoryValue,
      askAgentMessage: "What's the listing history?",
      toolTipExplainer:
        "Listing history provides insights into the property's market activity, such as price changes and time on the market.\n\n" +
        "This can indicate whether the property has been difficult to sell or if it has had price reductions.",
    },

    // Sales History
    {
      group: PropertyGroups.SALES_HISTORY,
      label: "Price Change from last sale",
      key: "priceDiscrepancy",
      status:
        ExtractedPropertyScrapingData.salesHistory.priceDiscrepancy.status ?? DataStatus.ASK_AGENT,
      value: ExtractedPropertyScrapingData.salesHistory.priceDiscrepancy.value,
      askAgentMessage:
        priceDiscrepancyMessages[
          ExtractedPropertyScrapingData.salesHistory.priceDiscrepancy.reason ?? ""
        ]?.askAgentMessage || "",
      toolTipExplainer:
        priceDiscrepancyMessages[
          ExtractedPropertyScrapingData.salesHistory.priceDiscrepancy.reason ?? ""
        ]?.toolTipExplainer ||
        "This metric shows the percentage change between the current listing price and the last sold price, " +
        "adjusted for the time span between these transactions. It helps determine whether the price is aligned with historical market trends.",
    },
    {
      group: PropertyGroups.SALES_HISTORY,
      label: "Historical Compound Annual Growth Rate (CAGR)",
      key: "compoundAnnualGrowthRate",
      status: (() => {
        const historicalCAGR = ExtractedPropertyScrapingData.salesHistory.compoundAnnualGrowthRate;
        if (historicalCAGR === null || typeof historicalCAGR !== "number") {
          return DataStatus.FOUND_POSITIVE; // this means no sales history, so is fine.
        }
        // Flag bag compound annual growth rate
        return historicalCAGR < 0.03 ? DataStatus.ASK_AGENT : DataStatus.FOUND_POSITIVE;
      })(),
      value:
        ExtractedPropertyScrapingData.salesHistory.compoundAnnualGrowthRate !== null &&
          typeof ExtractedPropertyScrapingData.salesHistory.compoundAnnualGrowthRate === "number"
          ? `${(ExtractedPropertyScrapingData.salesHistory.compoundAnnualGrowthRate * 100).toFixed(2)}%`
          : "N/A",
      askAgentMessage: (() => {
        const cagr = ExtractedPropertyScrapingData.salesHistory.compoundAnnualGrowthRate;
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
        (ExtractedPropertyScrapingData.salesHistory.compoundAnnualGrowthRate === null
          ? "\n\nIt is N/A as there is no sales history."
          : ""),
    },
    {
      group: PropertyGroups.SALES_HISTORY,
      label: "Volatility",
      key: "volatility",
      status: (() => {
        const volStr = ExtractedPropertyScrapingData.salesHistory.volatility;
        if (!volStr) return DataStatus.ASK_AGENT;
        const volatilityNumber = parseFloat(volStr.replace("%", ""));
        return (!isNaN(volatilityNumber) && volatilityNumber <= volatilityThreshold) ||
          volStr === "N/A"
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT;
      })(),
      value: ExtractedPropertyScrapingData.salesHistory.volatility,
      askAgentMessage: (() => {
        const volStr = ExtractedPropertyScrapingData.salesHistory.volatility;
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
    },

    // Interior Details
    {
      group: PropertyGroups.INTERIOR,
      label: "Bedrooms",
      key: "bedrooms",
      status: ExtractedPropertyScrapingData.bedrooms
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: ExtractedPropertyScrapingData.bedrooms,
      askAgentMessage: "How many bedrooms?",
      toolTipExplainer:
        "The number of bedrooms in a property is a key factor in its desirability and value.\n\n" +
        "More bedrooms generally indicate a larger living space, which can be more valuable in the housing market.",
    },
    {
      group: PropertyGroups.INTERIOR,
      label: "Bathrooms",
      key: "bathrooms",
      status: ExtractedPropertyScrapingData.bathrooms
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: ExtractedPropertyScrapingData.bathrooms,
      askAgentMessage: "How many bathrooms?",
      toolTipExplainer:
        "The number of bathrooms in a property is a key factor in its desirability and value.\n\n" +
        "More bathrooms generally indicate a larger living space, which can be more valuable in the housing market.",
    },
    {
      group: PropertyGroups.INTERIOR,
      label: "Heating Type",
      key: "heatingType",
      status: getStatusFromString(ExtractedPropertyScrapingData.heating),
      value: ExtractedPropertyScrapingData.heating,
      askAgentMessage: "What's the heating type?",
      toolTipExplainer:
        "Heating type refers to the method of heating used in the property, such as gas central heating, electric heating, or underfloor heating.\n\n" +
        "It can also include specific types like boilers, radiators, or heat pumps.\n\n" +
        "Understanding the heating type helps in assessing the property's energy efficiency and comfort.",
    },
    {
      group: PropertyGroups.INTERIOR,
      label: "Size",
      key: "size",
      status: getStatusFromString(ExtractedPropertyScrapingData.size),
      value: ExtractedPropertyScrapingData.size,
      askAgentMessage: "What's the size?",
      toolTipExplainer:
        "The size of a property refers to the total area of the property, including all habitable rooms and spaces.\n\n" +
        "It is a key factor in determining the property's value, as larger properties generally have higher value.\n\n" +
        "Size can also impact the property's energy efficiency and maintenance costs.",
    },
    {
      group: PropertyGroups.INTERIOR,
      label: "Floor Plan",
      key: "floorPlan",
      status: getStatusFromString(ExtractedPropertyScrapingData.floorPlan),
      value: DOMPurify.sanitize(ExtractedPropertyScrapingData.floorPlan ?? ""),
      askAgentMessage: "Do you have a floor plan?",
      toolTipExplainer:
        "A floor plan is a detailed layout of the property's interior spaces, including rooms, hallways, and other features.\n\n" +
        "It provides a visual representation of the property's layout and can be useful for understanding the property's size, layout, and potential for renovation or extension.",
    },
    {
      group: PropertyGroups.EXTERIOR,
      label: "Garden",
      key: "garden",
      status: getYesNoOrMissingStatus(ExtractedPropertyScrapingData.garden),
      value: ExtractedPropertyScrapingData.garden ?? "Not mentioned",
      askAgentMessage: "Is there a garden?",
      toolTipExplainer:
        "A garden is a private outdoor space associated with a property, providing a place for relaxation, entertainment, and gardening.\n\n" +
        "It can range from a small patio or balcony to a large garden with various features like lawns, trees, and outdoor living areas.",
    },
    {
      group: PropertyGroups.EXTERIOR,
      label: "Windows",
      key: "windows",
      status:
        typeof ExtractedPropertyScrapingData.windows === "string" &&
          ExtractedPropertyScrapingData.windows.toLowerCase() !== agentMissingInfo
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value: ExtractedPropertyScrapingData.windows,
      askAgentMessage: "Windows - material & glazing?",
      toolTipExplainer:
        "The key information to know is the materials, such as wood, aluminium, or uPVC, and the glazing, such as single or double-glazed windows.\n\n" +
        "Understanding the window material and glazing can impact the property's energy efficiency and comfort.",
    },
    {
      group: PropertyGroups.EXTERIOR,
      label: "Parking",
      key: "parking",
      status: getYesNoOrMissingStatus(ExtractedPropertyScrapingData.parking),
      value: ExtractedPropertyScrapingData.parking ?? "Not mentioned",
      askAgentMessage: "Is there parking?",
      toolTipExplainer:
        "Parking can refer to how and where vehicles can be parked, and any associated costs.\n\n" +
        "Factors to consider include whether a parking space is owned by you, if parking is communal, or if a permit is needed.",
    },
    {
      group: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Listed property",
      key: "listedProperty",
      status: ExtractedPropertyScrapingData.listedProperty.status ?? DataStatus.ASK_AGENT,
      value: ExtractedPropertyScrapingData.listedProperty.value ?? "Not mentioned",
      askAgentMessage: ExtractedPropertyScrapingData.listedProperty.reason ?? "",
      toolTipExplainer:
        "A listed property is designated as being of architectural or historical interest and requires special permission before being altered.\n\n" +
        "There are three grades of listed buildings: Grade I (exceptional interest), Grade II (special interest, most common for homes), and Grade II* (national importance).",
    },
    {
      group: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Restrictions",
      key: "restrictions",
      status: getStatusFromBoolean(ExtractedPropertyScrapingData.restrictions, true),
      value: getYesNoOrAskAgentStringFromBoolean(ExtractedPropertyScrapingData.restrictions),
      askAgentMessage: "Any restrictions?",
      toolTipExplainer:
        "Restrictions are legal constraints on what can be done with the property, such as building height limits, conservation area regulations, or planning permissions.\n\n" +
        "These restrictions can impact the property's value and potential use.",
    },
    {
      group: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Public right of way obligation",
      key: "publicRightOfWayObligation",
      status: getStatusFromBoolean(ExtractedPropertyScrapingData.publicRightOfWayObligation, true),
      value: getYesNoOrAskAgentStringFromBoolean(
        ExtractedPropertyScrapingData.publicRightOfWayObligation
      ),
      askAgentMessage: "Public right of way obligation?",
      toolTipExplainer:
        "Public Rights of Way are legal obligations requiring access to private property, such as footpaths or bridleways.\n\n" +
        "Property owners may be responsible for upkeep and work with the council for maintenance.",
    },
    {
      group: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Private right of way obligation",
      key: "privateRightOfWayObligation",
      status: getStatusFromBoolean(ExtractedPropertyScrapingData.privateRightOfWayObligation, true),
      value: getYesNoOrAskAgentStringFromBoolean(
        ExtractedPropertyScrapingData.privateRightOfWayObligation
      ),
      askAgentMessage: "Private right of way obligation?",
      toolTipExplainer:
        "Private Rights of Way allow individuals or companies to access or alter land without requiring permission.\n\n" +
        "Examples include access rights for neighbouring properties or utility companies installing infrastructure.",
    },
    // Crime Score item added to asynchronously fetch and display the crime score without blocking the initial render
    {
      group: PropertyGroups.RISKS,
      label: "Crime Score",
      key: "crimeScore",
      status: getCrimeScoreStatus(isCrimeScoreLoading, crimeScoreData),
      value: getCrimeScoreValue(isCrimeScoreLoading, crimeScoreData, crimeScoreError),

      askAgentMessage: "Do you have any insights into the safety of the neighbourhood?",
      toolTipExplainer: "This metric provides insights into the safety of the location within a 1 mile radius over the last 6 months, based on public crime data from official sources and scored by our proprietary algorithm.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Flood Defences",
      key: "floodDefences",
      status: getStatusFromBoolean(ExtractedPropertyScrapingData.floodDefences),
      value: getYesNoOrAskAgentStringFromBoolean(ExtractedPropertyScrapingData.floodDefences),
      askAgentMessage: "Any flood defences?",
      toolTipExplainer:
        "Flood defences help protect the property from water damage.\n\n" +
        "It's important to check if the property is at risk of flooding or has a history of flooding, as this can impact insurance and value.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Flood Sources",
      key: "floodSources",
      status:
        (ExtractedPropertyScrapingData.floodSources ?? []).length > 0
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value:
        (ExtractedPropertyScrapingData.floodSources ?? []).length > 0
          ? (ExtractedPropertyScrapingData.floodSources?.join(", ") ?? "Not mentioned")
          : "Not mentioned",
      askAgentMessage: "Any flood sources?",
      toolTipExplainer:
        "Flood sources are the natural or man-made features that contribute to flooding, such as rivers, streams, dams, or levees.\n\n" +
        "Understanding the flood sources can help assess the property's risk of flooding and the effectiveness of flood defences.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Flooded in last 5 years",
      key: "floodedInLastFiveYears",
      status: getStatusFromBoolean(ExtractedPropertyScrapingData.floodedInLastFiveYears, true),
      value: getYesNoOrAskAgentStringFromBoolean(
        ExtractedPropertyScrapingData.floodedInLastFiveYears
      ),
      askAgentMessage: "Flooded in last 5 years?",
      toolTipExplainer:
        "A history of flooding can impact property value and insurance.\n\n" +
        "Buyers should check for any past flooding incidents and existing flood defences.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Building Safety",
      key: "buildingSafety",
      status: ExtractedPropertyScrapingData.buildingSafety.status ?? DataStatus.ASK_AGENT,
      value: ExtractedPropertyScrapingData.buildingSafety.value ?? "Not mentioned",
      askAgentMessage: ExtractedPropertyScrapingData.buildingSafety.reason ?? "",
      toolTipExplainer:
        "This item identifies building safety information by scanning for key terms. " +
        "Positive terms such as 'Fire Alarm System' indicate robust safety measures, while negative terms (e.g. 'Mould') " +
        "may flag potential concerns. The absence of any mention means further clarification might be needed.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Coastal Erosion",
      key: "coastalErosion",
      status: ExtractedPropertyScrapingData.coastalErosion.status ?? DataStatus.ASK_AGENT,
      value: ExtractedPropertyScrapingData.coastalErosion.value ?? "Not mentioned",
      askAgentMessage: ExtractedPropertyScrapingData.coastalErosion.reason ?? "",
      toolTipExplainer:
        "Coastal erosion isn't mentioned in the listing. This could mean the property isn't in a coastal area—or it might be an omission. Please confirm if there's any coastal risk.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Mining Impact",
      key: "miningImpact",
      status: ExtractedPropertyScrapingData.miningImpact.status ?? DataStatus.ASK_AGENT,
      value: ExtractedPropertyScrapingData.miningImpact.value ?? "Not mentioned",
      askAgentMessage: ExtractedPropertyScrapingData.miningImpact.reason ?? "",
      toolTipExplainer:
        "Mining impact refers to the impact of mining on the property and the surrounding area.\n\n" +
        "It's important to check the mining impact to ensure the property is not at risk of mining subsidence or other mining-related risks.",
    },
    {
      group: PropertyGroups.UTILITIES,
      label: "EPC Certificate",
      key: "epc",
      status: ExtractedPropertyScrapingData.epc ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT,
      value: DOMPurify.sanitize(ExtractedPropertyScrapingData.epc ?? ""),
      askAgentMessage: "Do you have the EPC certificate?",
      toolTipExplainer:
        "An Energy Performance Certificate (EPC) provides a property's energy efficiency rating, ranging from A (most efficient) to G (least efficient).\n\n" +
        "An EPC is required before a property is sold or rented and is valid for 10 years.",
    },
    {
      group: PropertyGroups.UTILITIES,
      label: "Council Tax Band",
      key: "councilTax",
      status: getStatusFromString(ExtractedPropertyScrapingData.councilTax, ["tbc"]),
      value: ExtractedPropertyScrapingData.councilTax,
      askAgentMessage: "What council tax band?",
      toolTipExplainer:
        "Council tax is a payment to the local authority for services like schools and waste collection.\n\n" +
        "Council tax bands are based on property value, and some exemptions apply (e.g., students).",
    },
    {
      group: PropertyGroups.UTILITIES,
      label: "Broadband",
      key: "broadband",
      status: ExtractedPropertyScrapingData.broadband
        ? (() => {
          const match = ExtractedPropertyScrapingData.broadband.match(
            BROADBAND_SPEED_UNDER_10MBS_REGEX
          );
          return match && parseInt(match[1]) <= 10
            ? DataStatus.ASK_AGENT
            : DataStatus.FOUND_POSITIVE;
        })()
        : DataStatus.ASK_AGENT,
      value: ExtractedPropertyScrapingData.broadband,
      askAgentMessage: "How's the broadband speed?",
      toolTipExplainer:
        "Broadband speed refers to the speed of internet connection, measured in megabits per second (Mbps).\n\n" +
        "Faster speeds provide better internet connectivity, allowing for faster downloads, streaming, and online activities.\n\n" +
        "It's important to check the broadband speed to ensure it meets your needs, especially for work, streaming, and gaming.",
    },
    // TODO: ON ROADMAP...
    // construction type of the property
    // Neighbourhood and Environment - noise levels
    // Planning permissions
  ];

  return checklist;
}
