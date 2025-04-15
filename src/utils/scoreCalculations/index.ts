import { DashboardScoreCategory } from "@/constants/dashboardConsts";
import { DashboardScores, PreprocessedData, PropertyDataListItem } from "@/types/property";
import calculateConnectivityScore from "./calculateConnectivityScore";
import { calculateInvestmentValueScore } from "./calculateInvestmentValueScore";
import { calculateRunningCostsScore } from "./calculateRunningCostsScore";
// Import other category calculators when created
// e.g., import { calculateNeighbourhoodScore } from './calculateNeighbourhoodScore';

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

  // TODO: Calculate Neighbourhood score
  // const neighbourhoodData = calculateNeighbourhoodScore(items, preprocessedData, crimeScore); // Requires crime data access
  // if (neighbourhoodData) {
  //     scores[DashboardScoreCategory.NEIGHBOURHOOD] = neighbourhoodData;
  // }

  // TODO: Calculate Property Condition score
  // const conditionData = calculatePropertyConditionScore(items, preprocessedData);
  // if (conditionData) {
  //     scores[DashboardScoreCategory.PROPERTY_CONDITION] = conditionData;
  // }

  return scores;
};

// Optionally export individual calculators if needed elsewhere
export { calculateConnectivityScore, calculateInvestmentValueScore, calculateRunningCostsScore };
