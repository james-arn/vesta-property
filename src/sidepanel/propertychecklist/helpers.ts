import { DataStatus, PriceDiscrepancyReason } from "../../types/property";
import { formatTimeInYearsMonthsWeeksDays } from "../../utils/dates";
import { agentMissingInfo } from "./propertyChecklist";

export function getYesNoOrMissingStatus(value: string | null): DataStatus {
  if (!value || (typeof value === "string" && value.toLowerCase() === agentMissingInfo)) {
    return DataStatus.ASK_AGENT;
  }
  return typeof value === "string" && value.toLowerCase() !== "no"
    ? DataStatus.FOUND_POSITIVE
    : DataStatus.FOUND_NEGATIVE;
}

export function getYesNoOrAskAgentStringFromBoolean(value: boolean | null): string {
  if (value === null) {
    return "Ask agent";
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
    return noIsPositive ? DataStatus.FOUND_NEGATIVE : DataStatus.FOUND_POSITIVE;
  }
  return noIsPositive ? DataStatus.FOUND_POSITIVE : DataStatus.FOUND_NEGATIVE;
}

export function calculateListingHistoryDetails(listingHistory: string | null): {
  status: DataStatus;
  value: string | null;
} {
  console.log("calculateListingHistoryDetails called with:", listingHistory);

  if (!listingHistory) {
    console.log("No listing history provided, returning ASK_AGENT status.");
    return { status: DataStatus.ASK_AGENT, value: listingHistory };
  }

  if (listingHistory.toLowerCase() === "added today") {
    console.log("Listing added today, returning FOUND_POSITIVE status.");
    return { status: DataStatus.FOUND_POSITIVE, value: listingHistory };
  } else if (listingHistory.toLowerCase() === "added yesterday") {
    console.log("Listing added yesterday, returning FOUND_POSITIVE status.");
    return { status: DataStatus.FOUND_POSITIVE, value: listingHistory };
  }

  const dateMatch = listingHistory.match(/Added on (\d{2})\/(\d{2})\/(\d{4})/);
  console.log("Date match result:", dateMatch);

  if (!dateMatch) {
    console.log("No valid date found in listing history, returning ASK_AGENT status.");
    return { status: DataStatus.ASK_AGENT, value: listingHistory };
  }
  // first comma is intentional, it stores 'Added on'
  const [, day, month, year] = dateMatch;
  console.log("Parsed date:", { day, month, year });

  const listingDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const currentDate = new Date();
  const timeDiff = currentDate.getTime() - listingDate.getTime();
  const daysOnMarket = timeDiff / (1000 * 3600 * 24);
  console.log("Days on market:", daysOnMarket);

  let status = DataStatus.FOUND_POSITIVE;
  let value = listingHistory;

  if (daysOnMarket > 90) {
    // More than 3 months
    const timeOnMarket = formatTimeInYearsMonthsWeeksDays(daysOnMarket);
    value += `, this property has been on the market for ${timeOnMarket}. It's worth asking the agent why this is the case.`;
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
    return "Ask agent";
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
