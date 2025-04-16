import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import { PriceDiscrepancyReason, PropertyGroups } from "@/constants/propertyConsts";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { ProcessedPremiumDataStatus } from "@/types/premiumStreetData";
import {
  Confidence,
  ConfidenceLevels,
  DataStatus,
  EpcData,
  PropertyDataListItem,
} from "@/types/property";
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

export function calculateListingHistoryDetails(listingHistory: string | null): {
  status: DataStatus;
  value: string | null;
} {
  if (!listingHistory) {
    return { status: DataStatus.ASK_AGENT, value: listingHistory };
  }

  if (listingHistory.toLowerCase() === "added today") {
    return { status: DataStatus.FOUND_POSITIVE, value: listingHistory };
  } else if (listingHistory.toLowerCase() === "added yesterday") {
    return { status: DataStatus.FOUND_POSITIVE, value: listingHistory };
  }

  const dateMatch = listingHistory.match(/Added on (\d{2})\/(\d{2})\/(\d{4})/);

  if (!dateMatch) {
    return { status: DataStatus.ASK_AGENT, value: listingHistory };
  }
  // first comma is intentional, it stores 'Added on'
  const [, day, month, year] = dateMatch;

  const listingDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const currentDate = new Date();
  const timeDiff = currentDate.getTime() - listingDate.getTime();
  const daysOnMarket = timeDiff / (1000 * 3600 * 24);

  let status = DataStatus.FOUND_POSITIVE;
  let value = listingHistory;

  if (daysOnMarket > 90) {
    // More than 3 months
    const timeOnMarket = formatTimeInYearsMonthsWeeksDays(daysOnMarket);
    value += `, on the market for ${timeOnMarket}. It's worth asking the agent why.`;
    status = DataStatus.ASK_AGENT;
    console.log(
      `Property on market for more than 90 days (${timeOnMarket}), updating status to ASK_AGENT.`
    );
  }

  console.log("Returning status and value:", { status, value });
  return { status, value };
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

export const determineEpcChecklistItemDetails = (
  propertyEpcData: EpcData,
  epcProcessingResult: EpcProcessorResult
): PropertyDataListItem => {
  const { isLoading, error, value: processedValue, confidence, source } = epcProcessingResult;
  const userProvidedValue = propertyEpcData.value;
  const userProvidedConfidence = propertyEpcData.confidence;

  const baseEpcItem = {
    label: "EPC Rating",
    key: "epc",
    checklistGroup: PropertyGroups.UTILITIES,
    dashboardGroup: DashboardScoreCategory.RUNNING_COSTS,
    isUnlockedWithPremium: false,
    isBoostedWithPremium: true,
  };

  // --- Loading State ---
  if (isLoading) {
    return {
      ...baseEpcItem,
      value: "Loading...",
      status: DataStatus.IS_LOADING,
      askAgentMessage: "Processing EPC...",
      toolTipExplainer: "Attempting to determine EPC rating.",
    };
  }

  // --- Error State ---
  if (error) {
    return {
      ...baseEpcItem,
      value: `Error: ${error}`,
      confidence: ConfidenceLevels.NONE,
      status: DataStatus.ASK_AGENT,
      askAgentMessage: `Error processing EPC (${error}). Ask Agent?`,
      toolTipExplainer: `EPC processing failed: ${error}`,
    };
  }

  const shouldUseUserValue =
    (userProvidedConfidence === ConfidenceLevels.USER_PROVIDED && userProvidedValue) ||
    (confidence !== ConfidenceLevels.HIGH && userProvidedValue);

  const finalValue: string | null | undefined = shouldUseUserValue
    ? userProvidedValue
    : processedValue;

  const finalConfidence: Confidence | null = shouldUseUserValue
    ? ConfidenceLevels.USER_PROVIDED
    : confidence;

  if (finalValue) {
    return {
      ...baseEpcItem,
      value: `${finalValue}`.trim(),
      confidence: finalConfidence,
      status: DataStatus.FOUND_POSITIVE,
      askAgentMessage: "Please can you confirm the EPC rating?",
      toolTipExplainer: `EPC Rating: ${finalValue}. Confidence: ${finalConfidence || "N/A"}. Source: ${source || "N/A"}.`,
    };
  }

  return {
    ...baseEpcItem,
    value: CHECKLIST_NO_VALUE.NOT_FOUND,
    confidence: null,
    status: DataStatus.ASK_AGENT,
    askAgentMessage: "Could not determine EPC rating. Ask Agent?",
    toolTipExplainer: `Could not automatically determine the EPC rating. Source: ${source || "N/A"}.`,
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
