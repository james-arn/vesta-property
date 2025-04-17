import { LEGAL_CONSTRAINT_POINTS } from "@/constants/scoreConstants";
import { PropertyDataListItem } from "@/types/property";

export const getLegalConstraintsLabel = (constraintScore: number): string => {
  if (constraintScore >= 80) return "Severe Constraints";
  if (constraintScore >= 60) return "Medium-High Constraints";
  if (constraintScore >= 40) return "Medium Constraints";
  if (constraintScore >= 20) return "Low-Medium Constraints";
  return "Low Constraints";
};

export const calculateTenureConstraintPoints = (tenure?: string | null): number => {
  if (!tenure) return LEGAL_CONSTRAINT_POINTS.UNKNOWN_TENURE;
  const lowerTenure = tenure.toLowerCase();
  if (lowerTenure.includes("leasehold")) return LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM; // Base points for leasehold
  if (lowerTenure.includes("share of freehold") || lowerTenure.includes("commonhold"))
    return LEGAL_CONSTRAINT_POINTS.LOW;
  // freehold assumed to be 0 points
  return 0;
};

export const calculateLegalPointsForStatus = (
  item: PropertyDataListItem | undefined,
  pointsIfPositive: number
): number => {
  return item?.status === "FOUND_POSITIVE" ? pointsIfPositive : 0;
};
