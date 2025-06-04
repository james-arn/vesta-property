import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { DataStatus } from "@/types/property";

// Define the expected shape of the conservationAreaDetails argument inline
interface ConservationAreaDetailsArg {
  conservationAreaDataAvailable: boolean | null;
  conservationArea: string | null;
}

/**
 * Checks if the property is in a conservation area based on available data.
 * @param conservationAreaDetails - The conservation area details from premium data.
 * @returns True if data is available and the property is in a conservation area, false otherwise.
 */
export const isInConservationArea = (
  conservationAreaDetails: ConservationAreaDetailsArg | null | undefined
): boolean => {
  if (
    conservationAreaDetails &&
    conservationAreaDetails.conservationAreaDataAvailable === true &&
    typeof conservationAreaDetails.conservationArea === "string" &&
    conservationAreaDetails.conservationArea.trim() !== ""
  ) {
    return true;
  }
  return false;
};

/**
 * Determines the display value for the conservation area.
 * @param conservationAreaDetails - The conservation area details from premium data.
 * @param CHECKLIST_NO_VALUE - Constant for 'Not Available' type values.
 * @returns A string representing the conservation area status for display.
 */
export const getConservationAreaDisplayValue = (
  conservationAreaDetails: ConservationAreaDetailsArg | null | undefined,
  isPremiumDataFetchedAndHasData: boolean | undefined
): string => {
  if (!isPremiumDataFetchedAndHasData) {
    return CHECKLIST_NO_VALUE.NOT_AVAILABLE;
  }
  if (isInConservationArea(conservationAreaDetails)) {
    // Ensure conservationAreaDetails is not null here for type safety, though isInConservationArea implies it's not.
    return `In conservation area: ${conservationAreaDetails?.conservationArea}`;
  }
  return "No";
};

/**
 * Determines the DataStatus for the conservation area.
 * @param conservationAreaDetails - The conservation area details from premium data.
 * @returns The DataStatus for the conservation area.
 */
export const getConservationAreaStatus = (
  conservationAreaDetails: ConservationAreaDetailsArg | null | undefined
): DataStatus => {
  if (isInConservationArea(conservationAreaDetails)) {
    return DataStatus.ASK_AGENT;
  }
  if (conservationAreaDetails?.conservationAreaDataAvailable === true) {
    return DataStatus.FOUND_POSITIVE; // Data available, confirmed not in an area
  }
  if (conservationAreaDetails?.conservationAreaDataAvailable === false) {
    return DataStatus.ASK_AGENT; // Data explicitly not available for the LA
  }
  return DataStatus.ASK_AGENT; // Data not available (details are null/undefined, or conservationAreaDataAvailable is null)
};
