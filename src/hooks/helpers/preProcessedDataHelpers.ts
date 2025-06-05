import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import {
  MobileServiceCoverageItem,
  ProcessedMobileServiceCoverageWithScoreAndLabel,
  ProcessedPremiumDataStatus,
  RestrictiveCovenant,
} from "@/types/premiumStreetData";
import { calculateMobileCoverageScoreValue } from "@/utils/scoreCalculations/helpers/connectivityProcessingHelpers";

const MOBILE_COVERAGE_LABELS = [
  { min: 90, label: "Excellent" },
  { min: 70, label: "Good" },
  { min: 50, label: "Fair" },
  { min: 30, label: "Poor" },
  { min: 0, label: "Very Poor" },
];

export const processRestrictiveCovenants = (
  premiumStatus: ProcessedPremiumDataStatus,
  premiumCovenants: RestrictiveCovenant[] | null | undefined,
  initialRestrictions: boolean | null | undefined
): RestrictiveCovenant[] | null => {
  // 1. Handle Successful Premium Query
  if (premiumStatus === "success") {
    if (Array.isArray(premiumCovenants)) {
      // Premium definitively found covenants (or lack thereof)
      return premiumCovenants; // Returns the array (could be empty [])
    }
    // If premiumCovenants is null/undefined despite success, fall through to initial scrape
  }

  if (premiumStatus === "pending") {
    return null; // Pre-premium, return null to show not known
  }

  // 2. Handle Failed/Pending Premium Query OR Successful Query with null/undefined covenants
  // Fallback to initial boolean scrape result
  if (initialRestrictions === true) {
    // Know they exist from scrape, but no details available (or premium didn't provide)
    return null;
  } else if (initialRestrictions === false) {
    // Know they don't exist from scrape
    return [];
  } else {
    // Initial scrape data is also null/undefined (truly unknown)
    return null;
  }
};

export function processMobileCoverageForScoreAndLabel(
  mobileCoverageData: MobileServiceCoverageItem[] | null | undefined
): ProcessedMobileServiceCoverageWithScoreAndLabel {
  if (!mobileCoverageData || mobileCoverageData.length === 0) {
    return {
      mobileServiceCoverageArray: [],
      mobileCoverageScore: null,
      mobileCoverageLabel: CHECKLIST_NO_VALUE.NOT_FOUND,
    };
  }
  const score = calculateMobileCoverageScoreValue(mobileCoverageData);
  const labelObj = MOBILE_COVERAGE_LABELS.find(({ min }) => score >= min);
  return {
    mobileServiceCoverageArray: mobileCoverageData,
    mobileCoverageScore: score,
    mobileCoverageLabel: labelObj ? labelObj.label : CHECKLIST_NO_VALUE.NOT_FOUND,
  };
}
