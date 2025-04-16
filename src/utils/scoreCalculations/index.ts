import { DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import { DashboardScores, PreprocessedData, PropertyDataListItem } from "@/types/property";
import { calculateCompletenessScore } from "./calculateCompletenessScore";
import { calculateConditionScore } from "./calculateConditionScore";
import calculateConnectivityScore from "./calculateConnectivityScore";
import { calculateEnvironmentalRiskScore } from "./calculateEnvironmentalRiskScore";
import { calculateInvestmentValueScore } from "./calculateInvestmentValueScore";
import { calculateRunningCostsScore } from "./calculateRunningCostsScore";

/**
 * Calculates all dashboard category scores based on the property checklist items and preprocessed data.
 * @param items - The array of PropertyDataListItem objects.
 * @param preprocessedData - The preprocessed data containing EPC scores, premium data, etc.
 * @returns An object containing scores for each DashboardScoreCategory.
 */
export const calculateDashboardScores = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData
): DashboardScores => {
  const scores: DashboardScores = {};

  // Calculate score for each category
  const runningCostsData = calculateRunningCostsScore(items, preprocessedData);
  if (runningCostsData) {
    scores[DashboardScoreCategory.RUNNING_COSTS] = runningCostsData;
  }

  const investmentData = calculateInvestmentValueScore(items, preprocessedData);
  if (investmentData) {
    scores[DashboardScoreCategory.INVESTMENT_VALUE] = investmentData;
  }

  const connectivityData = calculateConnectivityScore(items, preprocessedData);
  if (connectivityData) {
    scores[DashboardScoreCategory.CONNECTIVITY] = connectivityData;
  }

  const conditionData = calculateConditionScore(items, preprocessedData);
  if (conditionData) {
    scores[DashboardScoreCategory.CONDITION] = conditionData;
  }

  const environmentalData = calculateEnvironmentalRiskScore(items, preprocessedData);
  if (environmentalData) {
    scores[DashboardScoreCategory.ENVIRONMENTAL_RISK] = environmentalData;
  }

  // TODO: Calculate Legal Constraints score

  const listingCompletenessData = calculateCompletenessScore(items, preprocessedData);
  if (listingCompletenessData) {
    scores[DashboardScoreCategory.LISTING_COMPLETENESS] = listingCompletenessData;
  }

  return scores;
};

// Optionally export individual calculators if needed elsewhere
export {
  calculateCompletenessScore,
  calculateConditionScore,
  calculateConnectivityScore,
  calculateInvestmentValueScore,
  calculateRunningCostsScore,
};
