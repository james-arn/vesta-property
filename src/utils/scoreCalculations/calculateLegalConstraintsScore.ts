import { CategoryScoreData, PropertyDataListItem } from "@/types/property"; // Adjust path as needed
import { findItemByKey, getItemValue } from "@/utils/parsingHelpers";

// Define locally needed types/consts
interface CalculationData {
  calculatedLeaseMonths: number | null;
  epcScoreForCalculation: number; // Keep if needed by this specific calculation
}

// Specific helper (if only used here)
const mapTenureToRiskScore = (tenure?: string | null): number => {
  // Higher score = Higher Risk/Constraint Level
  if (!tenure) return 50;
  const lowerTenure = tenure.toLowerCase();
  if (lowerTenure.includes("freehold")) return 0; // Low constraint/risk
  if (lowerTenure.includes("leasehold")) return 70; // High constraint/risk
  if (lowerTenure.includes("share of freehold") || lowerTenure.includes("commonhold")) return 10; // Low-ish constraint
  return 50;
};

export const calculateLegalConstraintsScore = (
  items: PropertyDataListItem[],
  calculationData: CalculationData // Accept calculationData
): CategoryScoreData | undefined => {
  console.warn("Legal Constraints score calculation needs implementation beyond placeholders.");
  const tenureItem = findItemByKey(items, "tenure");
  let totalConstraintPoints = mapTenureToRiskScore(getItemValue(tenureItem));

  // --- Use calculatedLeaseMonths ---
  const leaseMonths = calculationData.calculatedLeaseMonths;
  if (leaseMonths !== null && leaseMonths < 12 * 80) {
    // Check if less than 80 years (in months)
    console.log("Lease term less than 80 years, adding constraint points.");
    totalConstraintPoints += 30; // Example: Add significant points for short lease
  }

  // TODO: check listedProperty, restrictions, etc. and add points ...
  const listedPropertyItem = findItemByKey(items, "listedProperty");
  const restrictionsItem = findItemByKey(items, "restrictions"); // Needs refinement based on value
  const publicRightOfWayItem = findItemByKey(items, "publicRightOfWay");

  // Example: Add points if listed property status is positive
  if (listedPropertyItem?.status === "FOUND_POSITIVE") {
    totalConstraintPoints += 15;
  }
  // Example: Add points if public right of way is positive
  if (publicRightOfWayItem?.status === "FOUND_POSITIVE") {
    totalConstraintPoints += 5;
  }
  // Example: Need more complex logic for restrictions (is 'Yes' positive or negative constraint?)
  // if (restrictionsItem?.value === "Yes") {
  //   totalConstraintPoints += 10;
  // }

  const finalScoreValue = Math.max(0, Math.min(100, totalConstraintPoints));

  const getLegalConstraintsLabel = (constraintScore: number): string => {
    if (constraintScore >= 65) return "Severe Constraints";
    if (constraintScore >= 50) return "Medium-High Constraints";
    if (constraintScore >= 35) return "Medium Constraints";
    if (constraintScore >= 20) return "Low-Medium Constraints";
    return "Low Constraints";
  };
  const scoreLabel = getLegalConstraintsLabel(finalScoreValue);

  return {
    score: { scoreValue: Math.round(finalScoreValue), maxScore: 100, scoreLabel },
    contributingItems: items, // TODO: Filter to actually contributing items
  };
};
