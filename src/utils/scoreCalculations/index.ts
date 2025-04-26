import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import {
  CategoryScoreData,
  DashboardScores,
  PreprocessedData,
  PropertyDataListItem,
} from "@/types/property";
import { findItemByKey, getItemValue } from "../parsingHelpers";
import { calculateCompletenessScore } from "./calculateCompletenessScore";
import { calculateConditionScore } from "./calculateConditionScore";
import calculateConnectivityScore from "./calculateConnectivityScore";
import { calculateEnvironmentalRiskScore } from "./calculateEnvironmentalRiskScore";
import { calculateInvestmentValueScore } from "./calculateInvestmentValueScore";
import { calculateLegalConstraintsScore } from "./calculateLegalConstraintsScore";
import { calculateRunningCostsScore } from "./calculateRunningCostsScore";

// Define a new return type
export interface CalculatedDashboardResult {
  categoryScores: DashboardScores;
  overallScore: number | null;
  dataCoverageScoreData: CategoryScoreData | undefined;
}

/**
 * Calculates the overall property score by averaging the scores of relevant categories.
 * Excludes the LISTING_COMPLETENESS category.
 * Moved from dashboardHelpers.ts
 * @param scores - The dashboard scores object.
 * @returns The calculated overall score (0-100) or null if no relevant scores are available.
 */
const calculateOverallScore = (scores: DashboardScores): number | null => {
  const relevantScores = Object.entries(scores)
    .filter(([key]) => key !== DashboardScoreCategory.LISTING_COMPLETENESS)
    .map((entry: [string, CategoryScoreData]): number | null => entry[1].score?.scoreValue ?? null)
    .filter((scoreValue): scoreValue is number => scoreValue !== null && !isNaN(scoreValue));

  if (relevantScores.length === 0) {
    return null;
  }

  const sum = relevantScores.reduce((acc, scoreValue) => acc + scoreValue, 0);
  return Math.round(sum / relevantScores.length);
};

/**
 * Calculates all dashboard category scores and the overall score based on the property checklist items and preprocessed data.
 * @param items - The array of PropertyDataListItem objects.
 * @param preprocessedData - The preprocessed data containing EPC scores, premium data, etc.
 * @returns An object containing category scores, overall score, and data coverage score data.
 */
export const calculateDashboardScores = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData
): CalculatedDashboardResult => {
  const categoryScores: DashboardScores = {};

  // Calculate score for each category
  const runningCostsData = calculateRunningCostsScore(items, preprocessedData);
  if (runningCostsData) {
    categoryScores[DashboardScoreCategory.RUNNING_COSTS] = runningCostsData;
  }

  const investmentData = calculateInvestmentValueScore(items, preprocessedData);
  if (investmentData) {
    categoryScores[DashboardScoreCategory.INVESTMENT_VALUE] = investmentData;
  }

  const connectivityData = calculateConnectivityScore(items, preprocessedData);
  if (connectivityData) {
    categoryScores[DashboardScoreCategory.CONNECTIVITY] = connectivityData;
  }

  const conditionData = calculateConditionScore(items, preprocessedData);
  if (conditionData) {
    categoryScores[DashboardScoreCategory.CONDITION] = conditionData;
  }

  const environmentalData = calculateEnvironmentalRiskScore(items, preprocessedData);
  if (environmentalData) {
    categoryScores[DashboardScoreCategory.ENVIRONMENT_RISK] = environmentalData;
  }

  const tenureItem = findItemByKey(items, CHECKLIST_KEYS.TENURE);
  const tenureValue = getItemValue(tenureItem);

  const legalCalculationData = {
    calculatedLeaseMonths: preprocessedData.calculatedLeaseMonths,
    tenure: typeof tenureValue === "string" ? tenureValue : null,
  };

  const legalConstraintsData = calculateLegalConstraintsScore(items, legalCalculationData);
  if (legalConstraintsData) {
    categoryScores[DashboardScoreCategory.LEGAL_CONSTRAINTS] = legalConstraintsData;
  }

  const listingCompletenessData = calculateCompletenessScore(items);
  if (listingCompletenessData) {
    categoryScores[DashboardScoreCategory.LISTING_COMPLETENESS] = listingCompletenessData;
  }

  const overallScore = calculateOverallScore(categoryScores);

  // Extract data coverage score data
  const dataCoverageScoreData = categoryScores[DashboardScoreCategory.LISTING_COMPLETENESS];

  // Return the combined result
  return {
    categoryScores,
    overallScore,
    dataCoverageScoreData,
  };
};
