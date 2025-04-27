import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import {
  CALCULATED_STATUS,
  CATEGORY_ITEM_MAP,
  DashboardScoreCategory,
} from "@/constants/dashboardScoreCategoryConsts";
import {
  GROUND_RENT_COST_SCORES,
  MAX_SCORE,
  RUNNING_COSTS_WEIGHTS,
  TENURE_COST_SCORES,
} from "@/constants/scoreConstants";
import {
  CategoryScoreData,
  DashboardScore,
  DataStatus,
  PreprocessedData,
  PropertyDataListItem,
  ScoreCalculationStatus,
} from "@/types/property";
import { findItemByKey, getItemValue } from "@/utils/parsingHelpers";
import {
  calculateGroundRentCostScore,
  calculateServiceChargeCostScore,
} from "./helpers/runningCostHelpers";
import { calculateEpcScoreValue } from "./scoreCalculationHelpers";

// Helper specific to council tax calculation (remains local)
const mapCouncilTaxToScore = (band?: string | null): number => {
  const bandMap: { [key: string]: number } = {
    A: 10,
    B: 20,
    C: 30,
    D: 45,
    E: 60,
    F: 75,
    G: 90,
    H: 100,
    I: 100,
  };
  const defaultScore = 50;
  return typeof band === "string"
    ? (bandMap[band.trim().toUpperCase()] ?? defaultScore)
    : defaultScore;
};

export const calculateRunningCostsScore = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData
): CategoryScoreData => {
  const contributingFactorKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.RUNNING_COSTS] || [];
  const contributingItems = items.filter((item) =>
    (contributingFactorKeys as string[]).includes(item.key)
  );

  const councilTaxItem = findItemByKey(items, CHECKLIST_KEYS.COUNCIL_TAX);
  const tenureItem = findItemByKey(items, CHECKLIST_KEYS.TENURE);
  const groundRentItem = findItemByKey(items, CHECKLIST_KEYS.GROUND_RENT);
  const serviceChargeItem = findItemByKey(items, CHECKLIST_KEYS.SERVICE_CHARGE);

  const warnings: string[] = [];

  if (
    preprocessedData.epcScoreForCalculation === null ||
    preprocessedData.epcScoreForCalculation === undefined
  ) {
    console.warn("EPC score for calculation is missing in preprocessedData.");
    return {
      score: null,
      contributingItems,
      warningMessages: ["EPC data missing, cannot calculate Running Costs score."],
      calculationStatus: CALCULATED_STATUS.UNCALCULATED_MISSING_DATA,
    };
  }

  const calculationStatus: ScoreCalculationStatus = CALCULATED_STATUS.CALCULATED;

  // Calculate score components
  const epcEfficiencyScore = calculateEpcScoreValue(preprocessedData.epcScoreForCalculation);
  const epcCostScore = MAX_SCORE - epcEfficiencyScore;

  const councilTaxValue = getItemValue(councilTaxItem);
  const councilTaxCostScore = mapCouncilTaxToScore(councilTaxValue);

  const tenureValue = getItemValue(tenureItem);
  const isLeasehold =
    typeof tenureValue === "string" && tenureValue.toLowerCase().includes("leasehold");
  const isTenureFoundPositive = tenureItem?.status === DataStatus.FOUND_POSITIVE;
  const isTenureKnown =
    tenureItem &&
    tenureItem.status !== DataStatus.ASK_AGENT &&
    tenureItem.status !== DataStatus.IS_LOADING;

  const getBaseTenureCostScore = (): number => {
    if (!isTenureKnown) return TENURE_COST_SCORES.UNKNOWN;
    return isLeasehold ? TENURE_COST_SCORES.LEASEHOLD : TENURE_COST_SCORES.OTHER;
  };
  const tenureCostScore = getBaseTenureCostScore();

  let groundRentCostScore = GROUND_RENT_COST_SCORES.PEPPERCORN;
  let serviceChargeCostScore = 0;

  const groundRentValue = getItemValue(groundRentItem);
  const serviceChargeValue = getItemValue(serviceChargeItem);

  if (isLeasehold) {
    groundRentCostScore = calculateGroundRentCostScore(groundRentValue, groundRentItem?.status);
    serviceChargeCostScore = calculateServiceChargeCostScore(
      serviceChargeValue,
      serviceChargeItem?.status
    );
  } else if (isTenureFoundPositive) {
    groundRentCostScore = GROUND_RENT_COST_SCORES.PEPPERCORN;
    serviceChargeCostScore = 0;
  } else {
    groundRentCostScore = calculateGroundRentCostScore(groundRentValue, groundRentItem?.status);
    serviceChargeCostScore = calculateServiceChargeCostScore(
      serviceChargeValue,
      serviceChargeItem?.status
    );
  }

  const totalCostScore =
    councilTaxCostScore * RUNNING_COSTS_WEIGHTS.COUNCIL_TAX +
    epcCostScore * RUNNING_COSTS_WEIGHTS.EPC +
    tenureCostScore * RUNNING_COSTS_WEIGHTS.TENURE +
    groundRentCostScore * RUNNING_COSTS_WEIGHTS.GROUND_RENT +
    serviceChargeCostScore * RUNNING_COSTS_WEIGHTS.SERVICE_CHARGE;

  const finalScoreValue = Math.max(0, Math.min(MAX_SCORE, Math.round(totalCostScore)));

  const getRunningCostScoreLabel = (costScore: number): string => {
    if (costScore >= 70) return "Very High Cost";
    if (costScore >= 55) return "High Cost";
    if (costScore >= 40) return "Medium Cost";
    if (costScore >= 25) return "Low-Medium Cost";
    return "Low Cost";
  };
  const scoreLabel = getRunningCostScoreLabel(finalScoreValue);

  if (councilTaxItem?.status === DataStatus.ASK_AGENT) {
    warnings.push("Council Tax band missing, score uses estimate.");
  }
  if (isLeasehold) {
    if (groundRentItem?.status === DataStatus.ASK_AGENT) {
      warnings.push("Ground rent information missing, score uses estimate.");
    }
    if (serviceChargeItem?.status === DataStatus.ASK_AGENT) {
      warnings.push("Service charge information missing, score uses estimate.");
    }
  } else if (!isTenureKnown) {
    warnings.push("Tenure unknown, assuming Freehold for cost calculations.");
  }

  const finalScore: DashboardScore = {
    scoreValue: finalScoreValue,
    maxScore: MAX_SCORE,
    scoreLabel: scoreLabel,
  };

  return {
    score: finalScore,
    contributingItems,
    warningMessages: warnings,
    calculationStatus: calculationStatus,
  };
};
