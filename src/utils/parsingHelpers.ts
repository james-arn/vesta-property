import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { ChecklistKey } from "@/constants/checklistKeys";
import { PropertyDataListItem } from "@/types/property";
import React from "react";

/** Finds a specific checklist item by its key */
export const findItemByKey = (
  items: PropertyDataListItem[],
  key: ChecklistKey
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

/**
 * Parses common string representations of yes/no/true/false/present/absent into boolean.
 * Returns null if the value is missing, unknown, or cannot be clearly interpreted as true or false.
 */
export const parseYesNoUnknown = (value: React.ReactNode | null | undefined): boolean | null => {
  if (
    value === undefined ||
    value === null ||
    value === CHECKLIST_NO_VALUE.NOT_AVAILABLE ||
    value === CHECKLIST_NO_VALUE.NOT_MENTIONED ||
    value === "N/A"
  ) {
    return null;
  }

  // Direct boolean check
  if (typeof value === "boolean") {
    return value;
  }

  // Direct number check (0 is false, others true)
  if (typeof value === "number") {
    return value !== 0;
  }

  // String check
  if (typeof value === "string") {
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === "") return null;
    if (
      ["yes", "true", "present", "available", "y", "1", "at risk", "affected"].includes(lowerValue)
    ) {
      return true;
    }
    if (
      ["no", "false", "absent", "not available", "n", "0", "not at risk", "not affected"].includes(
        lowerValue
      )
    ) {
      return false;
    }
  }

  // Handle potential React nodes - simplistic check, might need refinement
  // This attempts to stringify simple React nodes like <span>Yes</span>
  // It won't work well for complex nodes.
  if (typeof value === "object" && React.isValidElement(value)) {
    try {
      // Check if props and children exist before accessing
      const props = value.props as { children?: React.ReactNode };
      if (props && props.children) {
        // Attempt to get text content - this is very basic
        const stringified = React.Children.toArray(props.children).join("");
        const lowerValue = stringified.toLowerCase().trim();
        if (lowerValue === "") return null;
        if (
          ["yes", "true", "present", "available", "y", "1", "at risk", "affected"].includes(
            lowerValue
          )
        ) {
          return true;
        }
        if (
          [
            "no",
            "false",
            "absent",
            "not available",
            "n",
            "0",
            "not at risk",
            "not affected",
          ].includes(lowerValue)
        ) {
          return false;
        }
      }
    } catch (e) {
      // Ignore errors during stringification
      console.warn("Could not stringify React node for boolean parsing:", value);
    }
  }

  // Fallback to null if type is unexpected or parsing failed
  return null;
};

/** Safely gets the value of a checklist item */
export const getItemValue = (item: PropertyDataListItem | undefined): any => {
  return item?.value;
};
