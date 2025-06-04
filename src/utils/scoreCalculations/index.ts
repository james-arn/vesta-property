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
import { calculateCostEfficiencyScore } from "./calculateCostEfficiencyScore";
import { calculateEnvironmentalRiskScore } from "./calculateEnvironmentalRiskScore";
import { calculateInvestmentValueScore } from "./calculateInvestmentValueScore";
import { calculateLegalConstraintsScore } from "./calculateLegalConstraintsScore";
import calculateOverallScore from "./helpers/calculateOverallScore";

export interface CalculatedDashboardResult {
  categoryScores: DashboardScores;
  overallScore: number | null;
  dataCoverageScoreData: CategoryScoreData | undefined;
}

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
  const runningCostsData = calculateCostEfficiencyScore(items, preprocessedData);
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
    processedConservationArea: preprocessedData.processedConservationArea,
  };

  const legalConstraintsData = calculateLegalConstraintsScore(items, legalCalculationData);
  if (legalConstraintsData) {
    categoryScores[DashboardScoreCategory.LEGAL_CONSTRAINTS] = legalConstraintsData;
  }

  const dataCoverageData = calculateCompletenessScore(items);
  if (dataCoverageData) {
    categoryScores[DashboardScoreCategory.DATA_COVERAGE] = dataCoverageData;
  }

  const overallScore = calculateOverallScore(categoryScores);

  const dataCoverageScoreData = categoryScores[DashboardScoreCategory.DATA_COVERAGE];

  return {
    categoryScores,
    overallScore,
    dataCoverageScoreData,
  };
};
