import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { PREMIUM_DATA_STATES } from "@/constants/propertyConsts";
import { LEGAL_CONSTRAINT_POINTS } from "@/constants/scoreConstants";
import { RestrictiveCovenant } from "@/types/premiumStreetData";
import { DataStatus, PropertyDataListItem, RightOfWayDetails } from "@/types/property";

export const getLegalConstraintsLabel = (finalScoreValue: number): string => {
  // Note: Scoring is 100 - penaltyPoints. So higher score means FEWER constraints.
  if (finalScoreValue <= 20) return "Severe Constraints";
  if (finalScoreValue <= 40) return "High Constraints";
  if (finalScoreValue <= 60) return "Medium Constraints";
  if (finalScoreValue <= 80) return "Low-Medium Constraints";
  return "Low Constraints"; // 81-100
};

export const calculateTenureConstraintPoints = (tenure?: string | null): number => {
  if (!tenure) return LEGAL_CONSTRAINT_POINTS.UNKNOWN_TENURE; // Penalty if tenure is missing
  const lowerTenure = tenure.toLowerCase();
  // Only leasehold incurs points directly, others are 0. Shared/Commonhold might need separate logic if complex.
  if (lowerTenure.includes("leasehold")) return LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM;
  return 0;
};

export const determinePenaltyPointsFromValue = (item: PropertyDataListItem): number => {
  if (!item) return 0; // Should not happen if called after data check, but safe fallback

  switch (item.key) {
    case CHECKLIST_KEYS.LISTED_PROPERTY:
      // Assign penalty if value indicates 'Yes' (property IS listed)
      return typeof item.value === "string" && item.value.toLowerCase().startsWith("yes")
        ? LEGAL_CONSTRAINT_POINTS.HIGH
        : 0;

    case CHECKLIST_KEYS.RESTRICTIVE_COVENANTS:
      // Assign penalty if the covenants array exists and is not empty
      const covenants = item.restrictiveCovenants as RestrictiveCovenant[] | null | undefined;
      return covenants && covenants.length > 0 ? LEGAL_CONSTRAINT_POINTS.MEDIUM : 0;

    case CHECKLIST_KEYS.PUBLIC_RIGHT_OF_WAY:
      // Assign penalty if the RightOfWay object exists and 'exists' is true
      const publicRoW = item.publicRightOfWay as RightOfWayDetails | null | undefined;
      return publicRoW?.exists === true ? LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM : 0;

    case CHECKLIST_KEYS.PRIVATE_RIGHT_OF_WAY:
      // Assign penalty if value is 'Yes'
      return item.value === "Yes" ? LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM : 0;

    case CHECKLIST_KEYS.PLANNING_PERMISSIONS:
      // Assign penalty if value indicates applications *were* found
      const notFoundPropertyValues = [
        PREMIUM_DATA_STATES.NO_APPLICATIONS,
        PREMIUM_DATA_STATES.NOT_FOUND,
        CHECKLIST_NO_VALUE.NOT_MENTIONED,
        CHECKLIST_NO_VALUE.NOT_AVAILABLE, // Adding common 'not available' checks
        "N/A",
      ];
      return typeof item.value === "string" && !notFoundPropertyValues.includes(item.value as any)
        ? LEGAL_CONSTRAINT_POINTS.LOW
        : 0;

    case CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS:
      // Assign penalty if value indicates nearby applications *were* found
      const notFoundNearbyValues = [
        PREMIUM_DATA_STATES.NO_NEARBY_APPLICATIONS,
        PREMIUM_DATA_STATES.NOT_FOUND,
        CHECKLIST_NO_VALUE.NOT_MENTIONED,
        CHECKLIST_NO_VALUE.NOT_AVAILABLE,
        "N/A",
      ];
      return typeof item.value === "string" && !notFoundNearbyValues.includes(item.value as any)
        ? LEGAL_CONSTRAINT_POINTS.LOW
        : 0;

    default:
      // Return 0 for any other keys handled by this function, as they don't incur penalty points based on value alone
      // (e.g., Tenure, Lease Term have specific logic elsewhere)
      return 0;
  }
};

export const isDataMissing = (item: PropertyDataListItem | undefined): boolean => {
  if (!item || item.status === DataStatus.IS_LOADING) {
    return true; // Undefined item or still loading is definitely missing data
  }
  // Consider explicit "not available" or "not mentioned" values as missing for scoring purposes
  if (
    typeof item.value === "string" &&
    (Object.values(CHECKLIST_NO_VALUE).includes(item.value as any) ||
      item.value === PREMIUM_DATA_STATES.NOT_FOUND ||
      item.value === PREMIUM_DATA_STATES.ERROR) // Treat error states as missing data for score calc
  ) {
    return true;
  }
  // Consider NOT_APPLICABLE status as data being present but not relevant for 'missing' check here
  // Other statuses like ASK_AGENT are considered 'data present' for this check,
  // but specific logic within determinePenaltyPointsFromValue will handle their values.
  return false;
};
