import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import { PriceDiscrepancyReason, PropertyGroups } from "@/constants/propertyConsts";
import { ProcessedPremiumDataStatus, RestrictiveCovenant } from "@/types/premiumStreetData";
import { ConfidenceLevels, DataStatus, EpcData, PropertyDataListItem } from "@/types/property";
import { formatTimeInYearsMonthsWeeksDays } from "../../utils/dates";

export function getYesNoOrMissingStatus(value: string | null): DataStatus {
  if (
    !value ||
    (typeof value === "string" && Object.values(CHECKLIST_NO_VALUE).includes(value as any))
  ) {
    return DataStatus.ASK_AGENT;
  }
  return typeof value === "string" && value.toLowerCase() !== "no"
    ? DataStatus.FOUND_POSITIVE
    : DataStatus.FOUND_NEGATIVE;
}

export function getYesNoOrAskAgentStringFromBoolean(value: boolean | null): string {
  if (value === null) {
    return CHECKLIST_NO_VALUE.NOT_MENTIONED;
  }
  return value ? "Yes" : "No";
}

export function getStatusFromBoolean(
  value: boolean | null,
  noIsPositive: boolean = false
): DataStatus {
  if (value === null) {
    return DataStatus.ASK_AGENT;
  }
  if (value) {
    return noIsPositive ? DataStatus.ASK_AGENT : DataStatus.FOUND_POSITIVE;
  }
  return noIsPositive ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT;
}

// Define the new return type
export interface ListingHistoryDetails {
  status: DataStatus;
  value: string | null; // The display string
  daysOnMarket: number | null;
}

export function calculateListingHistoryDetails(
  listingHistory: string | null
): ListingHistoryDetails {
  if (!listingHistory) {
    return { status: DataStatus.ASK_AGENT, value: listingHistory, daysOnMarket: null };
  }

  // Handle simple cases first
  if (listingHistory.toLowerCase() === "added today") {
    return { status: DataStatus.FOUND_POSITIVE, value: listingHistory, daysOnMarket: 0 };
  } else if (listingHistory.toLowerCase() === "added yesterday") {
    return { status: DataStatus.FOUND_POSITIVE, value: listingHistory, daysOnMarket: 1 };
  }

  // Attempt to parse date
  const dateMatch = listingHistory.match(/Added on (\d{2})\/(\d{2})\/(\d{4})/);
  if (!dateMatch) {
    // Cannot parse date, return original string and null days
    return { status: DataStatus.ASK_AGENT, value: listingHistory, daysOnMarket: null };
  }

  const [, day, month, year] = dateMatch;
  let daysOnMarketCalc: number | null = null;
  let listingDate: Date | null = null;

  try {
    listingDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(listingDate.getTime())) {
      const currentDate = new Date();
      const timeDiff = currentDate.getTime() - listingDate.getTime();
      // Use Math.floor for whole days, or Math.ceil if partial days count
      daysOnMarketCalc = Math.floor(timeDiff / (1000 * 3600 * 24));
    } else {
      console.warn("Parsed invalid date from listing history:", listingHistory);
    }
  } catch (error) {
    console.error("Error parsing date from listing history:", listingHistory, error);
  }

  let status = DataStatus.FOUND_POSITIVE;
  let displayValue = listingHistory;
  const LONG_LISTING_THRESHOLD_DAYS = 90;

  if (daysOnMarketCalc !== null && daysOnMarketCalc > LONG_LISTING_THRESHOLD_DAYS) {
    const timeOnMarket = formatTimeInYearsMonthsWeeksDays(daysOnMarketCalc);
    // Modify display value less aggressively, keep status positive unless explicitly reduced
    displayValue += `, listed ${timeOnMarket} ago.`;
    // Status could potentially change here if needed based on duration, but keep positive for now
    // status = DataStatus.ASK_AGENT; // Or maybe FOUND_NEGATIVE? Decide based on UX.
    console.log(
      `Property on market for more than ${LONG_LISTING_THRESHOLD_DAYS} days (${timeOnMarket}).`
    );
  }

  // Check for explicit price reduction mentions (simple check)
  if (listingHistory.toLowerCase().includes("reduced")) {
    status = DataStatus.FOUND_NEGATIVE; // Indicate reduction found
    console.log("Price reduction mentioned in listing history.");
    // Optionally add to displayValue if desired
    // displayValue += " (Price Reduced)";
  }

  return { status, value: displayValue, daysOnMarket: daysOnMarketCalc };
}

export function getYesNoOrAskAgentFromBoolean(value: boolean | null): string {
  if (value === null) {
    return CHECKLIST_NO_VALUE.NOT_MENTIONED;
  }
  return value ? "Yes" : "No";
}

const baseMessage =
  "Price Discrepancy compares the current listing price (even though it hasn't sold) with the last sold price, to indicate whether the property might be overvalued.\n\n";

export const priceDiscrepancyMessages: Record<
  string,
  { askAgentMessage: string; toolTipExplainer: string }
> = {
  [PriceDiscrepancyReason.NO_PREVIOUS_SOLD_HISTORY]: {
    askAgentMessage: "", // DataStatus is found positive and so not message needed.
    toolTipExplainer:
      baseMessage +
      "Since there is no past sale data to compare, the current listing price isn't assessed for discrepancy.",
  },
  [PriceDiscrepancyReason.MISSING_OR_INVALID_PRICE_DATA]: {
    askAgentMessage: "",
    toolTipExplainer:
      baseMessage +
      "Certain information is missing or contain errors. A reliable comparison cannot be made.",
  },
  [PriceDiscrepancyReason.PRICE_GAP_WITHIN_EXPECTED_RANGE]: {
    askAgentMessage: "", // DataStatus is found positive and so not message needed.
    toolTipExplainer:
      baseMessage +
      "The current listing is in line with historical trends, with the price difference falling within expected limits based on past growth.",
  },
  [PriceDiscrepancyReason.PRICE_GAP_EXCEEDS_EXPECTED_RANGE]: {
    askAgentMessage:
      "The current asking price appears significantly higher than what the historical growth would suggest. Could you please explain why this discrepancy exists?",
    toolTipExplainer:
      baseMessage +
      "When comparing the current listing price against historical data, we found that the implied annual growth rate exceeds expectations (by more than 50%). This suggests the price may be inflated relative to past trends and is worth asking the agent for any reasons why this is the case.",
  },
  [PriceDiscrepancyReason.PRICE_DROP]: {
    askAgentMessage:
      "The current asking price is lower than the last sold price. Is there a specific reason for this reduction?",
    toolTipExplainer:
      baseMessage +
      "A negative price discrepancy indicates that the current listing price is below the previous sold price. This might mean the property is being offered at a discount or reflects a market adjustment. Please consult with the agent to clarify if this drop is deliberate or due to other factors.",
  },
} as const;

export function getVolatilityStatus(volStr: string | null, threshold: number): DataStatus {
  if (!volStr) return DataStatus.ASK_AGENT;
  if (volStr === "N/A") return DataStatus.NOT_APPLICABLE;
  const volatilityNumber = parseFloat(volStr.replace("%", ""));
  if (!isNaN(volatilityNumber) && volatilityNumber <= threshold) {
    return DataStatus.FOUND_POSITIVE;
  }
  return DataStatus.ASK_AGENT;
}

export function getCAGRStatus(cagr: number | null): DataStatus {
  if (cagr === null || typeof cagr !== "number") {
    return DataStatus.NOT_APPLICABLE;
  }
  return cagr < 0.03 ? DataStatus.ASK_AGENT : DataStatus.FOUND_POSITIVE;
}

// Assuming ConfidenceLevels is a const object like:
// export const ConfidenceLevels = { HIGH: "High", NONE: "None", ... } as const;
// We derive a union type of its values for type annotations.
export type ConfidenceLevelsValues = (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels];

// Helper to map string confidence to ConfidenceLevelsValues type
const mapStringToConfidenceLevel = (
  confidenceStr: string | null | undefined
): ConfidenceLevelsValues => {
  if (!confidenceStr) return ConfidenceLevels.NONE;
  const upperConfidenceStr = confidenceStr.toUpperCase().replace(/\s+/g, "");

  switch (upperConfidenceStr) {
    case "HIGH":
      return ConfidenceLevels.HIGH;
    case "MEDIUM":
      return ConfidenceLevels.MEDIUM;
    case "CONFIRMEDBYGOVEPC":
      return ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED;
    case "USERPROVIDED":
      return ConfidenceLevels.USER_PROVIDED;
    default:
      // Check if the original string matches one of the object's values
      const confidenceValue = Object.values(ConfidenceLevels).find((val) => val === confidenceStr);
      if (confidenceValue) {
        return confidenceValue as ConfidenceLevelsValues;
      }
      // Fallback: Check if normalized string matches an uppercased value
      const matchedNormalizedValue = Object.values(ConfidenceLevels).find(
        (val) => val.toUpperCase().replace(/\s+/g, "") === upperConfidenceStr
      );
      if (matchedNormalizedValue) {
        return matchedNormalizedValue as ConfidenceLevelsValues;
      }
      console.warn("Unhandled confidence string: " + confidenceStr + ", defaulting to NONE");
      return ConfidenceLevels.NONE;
  }
};

export const generateEpcChecklistItem = (
  propertyEpcData: EpcData | undefined | null,
  isPreprocessedDataLoading: boolean,
  preprocessedDataError: Error | null,
  finalEpcValue: string | null | undefined,
  finalEpcConfidence: ConfidenceLevelsValues | null | undefined, // Use the derived type
  finalEpcSource: string | null | undefined,
  finalEpcBandData: any | null | undefined
): PropertyDataListItem => {
  const baseEpcItem = {
    label: "EPC Rating",
    key: CHECKLIST_KEYS.EPC,
    checklistGroup: PropertyGroups.UTILITIES,
    dashboardGroup: DashboardScoreCategory.RUNNING_COSTS,
    isExpectedInPremiumSearchData: false,
    isBoostedWithPremium: true,
    isExpectedInListing: true,
    epcBandData: finalEpcBandData ?? null,
    epcImageUrl: propertyEpcData?.displayUrl || propertyEpcData?.url || null,
    confidence: ConfidenceLevels.NONE, // Default confidence
  };

  if (isPreprocessedDataLoading) {
    return {
      ...baseEpcItem,
      value: "Loading...",
      status: DataStatus.IS_LOADING,
      askAgentMessage: "Processing EPC/Premium Data...",
      toolTipExplainer: "Attempting to determine EPC rating and other data.",
      // confidence already set in baseEpcItem
    };
  }

  if (preprocessedDataError) {
    const errorMsg = preprocessedDataError.message || "Processing failed";
    return {
      ...baseEpcItem,
      value: "Error: " + errorMsg,
      status: DataStatus.ASK_AGENT,
      askAgentMessage: "Error processing data (" + errorMsg + "). Ask Agent?",
      toolTipExplainer: "Data processing failed: " + errorMsg,
      // confidence already set in baseEpcItem
    };
  }

  if (finalEpcValue) {
    return {
      ...baseEpcItem,
      value: finalEpcValue,
      status: DataStatus.FOUND_POSITIVE,
      confidence: finalEpcConfidence ?? ConfidenceLevels.NONE,
      askAgentMessage: "",
      toolTipExplainer:
        "EPC Rating determined as " +
        finalEpcValue +
        ". Confidence: " +
        (finalEpcConfidence || "N/A") +
        ". Source: " +
        (finalEpcSource || "N/A") +
        ".",
    };
  }

  if (propertyEpcData?.value) {
    const determinedConfidence = mapStringToConfidenceLevel(propertyEpcData.confidence);
    return {
      ...baseEpcItem,
      value: propertyEpcData.value,
      status: DataStatus.FOUND_POSITIVE,
      confidence: determinedConfidence,
      askAgentMessage: "Please verify this EPC rating with the agent.",
      toolTipExplainer:
        "EPC Rating: " +
        propertyEpcData.value +
        ". Confidence: " +
        (determinedConfidence || "N/A") +
        ". Source: " +
        (propertyEpcData.source || "Scraped from page") +
        ".",
    };
  }

  // Default if no EPC data is found, confidence is already NONE from baseEpcItem
  return {
    ...baseEpcItem,
    value: CHECKLIST_NO_VALUE.NOT_AVAILABLE,
    status: DataStatus.ASK_AGENT,
    askAgentMessage: "Could not determine EPC. Ask Agent?",
    toolTipExplainer: "Could not determine the EPC rating from available data.",
    isExpectedInPremiumSearchData: true,
  };
};

export const getPremiumStatus = (
  premiumStatus: ProcessedPremiumDataStatus,
  dataValue: unknown
): DataStatus => {
  switch (premiumStatus) {
    case "loading":
    case "pending":
      return DataStatus.IS_LOADING;
    case "error":
      return DataStatus.ASK_AGENT; // Or potentially a specific error status
    case "success":
      return dataValue !== null && dataValue !== undefined
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT;
    case "idle":
    default:
      return DataStatus.ASK_AGENT;
  }
};

// Helper to get status for restrictive covenants
export const getRestrictiveCovenantsStatus = (
  covenants: RestrictiveCovenant[] | null,
  isLoading: boolean = false
): DataStatus => {
  if (isLoading) {
    return DataStatus.IS_LOADING;
  }
  if (covenants === null) {
    // Null means unknown, or known to exist but details unavailable initially
    return DataStatus.ASK_AGENT; // Status is unknown
  }
  if (covenants.length === 0) {
    // Empty array means definitively none found
    return DataStatus.FOUND_POSITIVE; // Positive = good = no restrictions found
  }
  // Array with items means restrictions were found - requires investigation
  return DataStatus.ASK_AGENT; // Use Ask Agent to signal investigation needed
};

export const getRestrictiveCovenantsValue = (
  covenants: RestrictiveCovenant[] | null,
  isLoading: boolean = false
): string => {
  if (isLoading) {
    return "Loading...";
  }

  if (covenants === null) {
    // Initial listing DOM scrape has not found any restrictive covenants
    return CHECKLIST_NO_VALUE.NOT_MENTIONED;
  }
  if (covenants.length === 0) {
    return CHECKLIST_NO_VALUE.NONE_FOUND;
  }
  // This will be overridden by the custom rendering in ChecklistItem.tsx
  return "Yes";
};

export const getRestrictiveCovenantMessages = (
  status: DataStatus,
  covenantsFound: boolean
): { askAgentMessage: string; toolTipExplainer: string } => {
  switch (status) {
    case DataStatus.FOUND_POSITIVE: // None found
      return {
        askAgentMessage: "",
        toolTipExplainer:
          "No restrictive covenants were found in the available data. Your conveyancer will confirm this by checking the official Title Register.",
      };
    case DataStatus.ASK_AGENT: // Status is Ask Agent
      if (covenantsFound) {
        // Ask Agent because covenants *were* found
        return {
          askAgentMessage:
            "Restrictive covenants are indicated. Please ensure my conveyancer receives the full details from the Title Register.",
          toolTipExplainer:
            "Legal obligations restricting property use/modification (e.g., limits on extensions). \n\n**Crucial:** Your conveyancer must obtain and review the official Title Register from HM Land Registry for the definitive wording and implications.",
        };
      } else {
        // Ask Agent because status was initially unknown
        return {
          askAgentMessage:
            "Are there any restrictive covenants on this property? Please ensure the Title Register is checked.",
          toolTipExplainer:
            "Could not determine if restrictive covenants apply from available data. \n\n**Crucial:** Your conveyancer must obtain and review the official Title Register from HM Land Registry.",
        };
      }
    case DataStatus.IS_LOADING:
      return {
        askAgentMessage: "",
        toolTipExplainer: "Checking for restrictive covenants...",
      };
    default:
      // Default case (should ideally not be hit)
      return {
        askAgentMessage: "",
        toolTipExplainer:
          "Legal obligations restricting property use/modification (e.g., limits on extensions). \n\n**Crucial:** Your conveyancer must obtain and review the official Title Register from HM Land Registry for the definitive wording and implications.",
      };
  }
};
