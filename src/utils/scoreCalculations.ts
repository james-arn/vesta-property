import { CATEGORY_ITEM_MAP, DashboardScoreCategory } from "@/constants/dashboardConsts";
import { ProcessedPremiumStreetData } from "@/types/premiumStreetData";
import { CategoryScoreData, DashboardScores, PropertyDataListItem } from "@/types/property";
import { calculateCompletenessScore } from "./scoreCalculations/calculateCompletenessScore";
import { calculateConditionScore } from "./scoreCalculations/calculateConditionScore";
import { calculateConnectivityScore } from "./scoreCalculations/calculateConnectivityScore";
import { calculateEnvironmentalRiskScore } from "./scoreCalculations/calculateEnvironmentalRiskScore";
import { calculateInvestmentValueScore } from "./scoreCalculations/calculateInvestmentValueScore";
import { calculateLegalConstraintsScore } from "./scoreCalculations/calculateLegalConstraintsScore";
import { calculateRunningCostsScore } from "./scoreCalculations/calculateRunningCostsScore";

// Shared type definition (needed by orchestrator and specific calculators)
interface CalculationData {
  calculatedLeaseMonths: number | null;
  epcScoreForCalculation: number;
}

const UNAVAILABLE_SCORE_DATA: CategoryScoreData = {
  score: { scoreValue: 0, maxScore: 100, scoreLabel: "Unavailable" },
  contributingItems: [],
  warningMessage: "Required data missing for calculation.",
};

// Keep shared mappers here for now
export const mapEpcToScore = (rating?: string | number | null): number => {
  const averageScore = 55; // Score equivalent to 'D' rating UK average

  if (typeof rating === "number") {
    return Math.max(0, Math.min(100, rating));
  }
  if (typeof rating === "string") {
    const grade = rating.trim().charAt(0).toUpperCase();
    const gradeMap: { [key: string]: number } = { A: 95, B: 85, C: 70, D: 55, E: 40, F: 25, G: 10 };
    // Return score for valid grade, otherwise return the average score
    return gradeMap[grade] ?? averageScore;
  }
  return averageScore; // Return average if rating is null/undefined/invalid type
};

// --- Main Orchestration Function --- //
export const calculateDashboardScores = (
  checklistData: PropertyDataListItem[] | null,
  calculationData: CalculationData,
  processedPremiumData: ProcessedPremiumStreetData
): DashboardScores => {
  if (!checklistData) return {};

  const outcodeTurnoverRate = processedPremiumData.outcodeTurnoverRate;

  // Helper to get items relevant to a specific category score
  const getItemsForCategory = (category: DashboardScoreCategory): PropertyDataListItem[] => {
    const itemKeys = CATEGORY_ITEM_MAP[category] || [];
    // Filter checklistData based on the keys defined for the category
    return checklistData.filter((item) => itemKeys.includes(item.key));
  };

  // Call individual calculation functions
  const scores: Partial<DashboardScores> = {
    [DashboardScoreCategory.RUNNING_COSTS]: calculateRunningCostsScore(
      getItemsForCategory(DashboardScoreCategory.RUNNING_COSTS),
      calculationData
    ),
    [DashboardScoreCategory.INVESTMENT_VALUE]: calculateInvestmentValueScore({
      items: getItemsForCategory(DashboardScoreCategory.INVESTMENT_VALUE),
      outcodeTurnoverRate,
    }),
    [DashboardScoreCategory.CONNECTIVITY]: calculateConnectivityScore(
      getItemsForCategory(DashboardScoreCategory.CONNECTIVITY)
    ),
    [DashboardScoreCategory.CONDITION]: calculateConditionScore(
      getItemsForCategory(DashboardScoreCategory.CONDITION)
    ),
    [DashboardScoreCategory.ENVIRONMENTAL_RISK]: calculateEnvironmentalRiskScore(
      getItemsForCategory(DashboardScoreCategory.ENVIRONMENTAL_RISK)
    ),
    [DashboardScoreCategory.LEGAL_CONSTRAINTS]: calculateLegalConstraintsScore(
      getItemsForCategory(DashboardScoreCategory.LEGAL_CONSTRAINTS),
      calculationData // Pass calculationData
    ),
    [DashboardScoreCategory.LISTING_COMPLETENESS]: calculateCompletenessScore(checklistData), // Uses all items
  };

  // Ensure all categories have a score object, using UNAVAILABLE_SCORE_DATA as default
  const finalScores = Object.values(DashboardScoreCategory).reduce((acc, category) => {
    acc[category] = scores[category] ?? { ...UNAVAILABLE_SCORE_DATA }; // Use spread for default
    return acc;
  }, {} as DashboardScores);

  return finalScores;
};
