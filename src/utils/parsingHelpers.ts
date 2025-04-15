import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { PropertyDataListItem } from "@/types/property";

/** Finds a specific checklist item by its key */
export const findItemByKey = (
  items: PropertyDataListItem[],
  key: string
): PropertyDataListItem | undefined => {
  return items.find((item) => item.key === key);
};

/** Parses currency strings (e.g., "£176,000") into numbers */
export const parseCurrency = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number") return value;
  if (
    typeof value !== "string" ||
    !value ||
    value === CHECKLIST_NO_VALUE.NOT_AVAILABLE ||
    value === CHECKLIST_NO_VALUE.NOT_MENTIONED
  ) {
    return null;
  }
  const cleaned = value.replace(/[^0-9.-]+/g, "");
  const number = parseFloat(cleaned);
  return isNaN(number) ? null : number;
};

/** Parses percentage strings (e.g., "8.30%") into decimal numbers (e.g., 0.083) */
export const parsePercentage = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number") {
    // Assume if it's already a number, it's the decimal form (e.g., 0.083)
    // If it could be > 1 (e.g., 8.3), divide by 100. This heuristic might need adjustment.
    return value > 1 ? value / 100 : value;
  }
  if (
    typeof value !== "string" ||
    !value ||
    value === CHECKLIST_NO_VALUE.NOT_AVAILABLE ||
    value === CHECKLIST_NO_VALUE.NOT_MENTIONED ||
    value === "N/A"
  ) {
    return null;
  }
  const cleaned = value.replace(/[^0-9.-]+/g, "");
  const number = parseFloat(cleaned);
  // Divide by 100 to convert percentage to decimal
  return isNaN(number) ? null : number / 100;
};

/** Parses strings like "208 sales in last 12m" */
export const parseSalesVolume = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number") return value;
  if (
    typeof value !== "string" ||
    !value ||
    value === CHECKLIST_NO_VALUE.NOT_AVAILABLE ||
    value === CHECKLIST_NO_VALUE.NOT_MENTIONED
  ) {
    return null;
  }
  const match = value.match(/^(\d+)\s*sales/i);
  if (match && match[1]) {
    const number = parseInt(match[1], 10);
    return isNaN(number) ? null : number;
  }
  return null;
};

/** More generic number parsing, handling N/A */
export const parseNumberFromString = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number") return value;
  if (
    typeof value !== "string" ||
    !value ||
    value === CHECKLIST_NO_VALUE.NOT_AVAILABLE ||
    value === CHECKLIST_NO_VALUE.NOT_MENTIONED ||
    value === "N/A"
  ) {
    return null;
  }
  const cleaned = value.replace(/[^0-9.-]+/g, "");
  const number = parseFloat(cleaned);
  return isNaN(number) ? null : number;
};

/** Safely gets the value of a checklist item */
export const getItemValue = (item: PropertyDataListItem | undefined): any => {
  return item?.value;
};
