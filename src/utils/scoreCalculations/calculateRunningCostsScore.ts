import { CATEGORY_ITEM_MAP, DashboardScoreCategory } from "@/constants/dashboardConsts";
import { RUNNING_COSTS_WEIGHTS, TENURE_COST_SCORES } from "@/constants/scoreConstants";
import { CategoryScoreData, DataStatus, PropertyDataListItem } from "@/types/property"; // Adjust path as needed
import { findItemByKey, getItemValue } from "@/utils/parsingHelpers";

// Define locally needed types/consts (move to shared types if needed by others)
interface CalculationData {
  calculatedLeaseMonths: number | null;
  epcScoreForCalculation: number;
}

const UNAVAILABLE_SCORE_DATA: CategoryScoreData = {
  score: { scoreValue: 0, maxScore: 100, scoreLabel: "Unavailable" },
  contributingItems: [],
  warningMessage: "Required data missing for calculation.",
};

// Helper specific to this calculation (if needed, or move if general)
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
  return typeof band === "string" ? (bandMap[band.trim().toUpperCase()] ?? 50) : 50;
};

export const calculateRunningCostsScore = (
  items: PropertyDataListItem[],
  calculationData: CalculationData
): CategoryScoreData => {
  const contributingKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.RUNNING_COSTS] || [];
  const contributingItemsFound = items.filter((item) => contributingKeys.includes(item.key));

  const councilTaxItem = findItemByKey(contributingItemsFound, "councilTax");
  const epcItem = findItemByKey(contributingItemsFound, "epc");
  const tenureItem = findItemByKey(contributingItemsFound, "tenure");

  // Council tax is essential
  if (!councilTaxItem || councilTaxItem.status === DataStatus.ASK_AGENT) {
    console.warn("Cannot calculate running costs score without valid council tax data.");
    // Return a default unavailable score object
    return {
      ...UNAVAILABLE_SCORE_DATA,
      contributingItems: contributingItemsFound, // Still show contributing items
      warningMessage: "Valid council tax data needed for Running Costs score.",
    };
  }

  const councilTaxValue = getItemValue(councilTaxItem);
  const epcValue = getItemValue(epcItem);
  const tenureValue = getItemValue(tenureItem);

  const epcCostScore = 100 - calculationData.epcScoreForCalculation;

  const getTenureCostScore = (): number => {
    if (!tenureItem || tenureItem.status === DataStatus.ASK_AGENT) {
      return TENURE_COST_SCORES.UNKNOWN;
    }
    if (tenureItem.status === DataStatus.FOUND_POSITIVE && typeof tenureValue === "string") {
      return tenureValue.toLowerCase().includes("leasehold")
        ? TENURE_COST_SCORES.LEASEHOLD
        : TENURE_COST_SCORES.OTHER;
    }
    return TENURE_COST_SCORES.UNKNOWN;
  };
  const tenureCostScore = getTenureCostScore();

  // Calculate weighted total cost score
  const totalCostScore =
    mapCouncilTaxToScore(councilTaxValue) * RUNNING_COSTS_WEIGHTS.COUNCIL_TAX +
    epcCostScore * RUNNING_COSTS_WEIGHTS.EPC +
    tenureCostScore * RUNNING_COSTS_WEIGHTS.TENURE;

  // Clamp the raw cost score (higher = more costly)
  const finalScoreValue = Math.max(0, Math.min(100, totalCostScore));

  // Adjust label function to work with direct cost score (higher number = higher cost)
  const getRunningCostScoreLabel = (costScore: number): string => {
    if (costScore >= 65) return "High Cost"; // e.g. 65-100
    if (costScore >= 50) return "Medium-High Cost"; // e.g. 50-64
    if (costScore >= 35) return "Medium Cost"; // e.g. 35-49
    if (costScore >= 20) return "Low-Medium Cost"; // e.g. 20-34
    return "Low Cost"; // e.g. 0-19
  };
  const scoreLabel = getRunningCostScoreLabel(finalScoreValue);

  // Generate Warnings
  const warnings: string[] = [];
  if (!epcItem || epcItem.status === DataStatus.ASK_AGENT) {
    warnings.push("EPC rating not found or invalid; score calculated using UK average (D).");
  }
  if (!tenureItem || tenureItem.status === DataStatus.ASK_AGENT) {
    warnings.push(
      "Tenure could not be confirmed automatically. Leasehold properties may incur additional costs."
    );
  } else if (tenureCostScore === TENURE_COST_SCORES.LEASEHOLD) {
    warnings.push(
      "Leasehold tenure typically involves additional costs (e.g., ground rent, service charges)."
    );
  }
  const combinedWarningMessage = warnings.length > 0 ? warnings.join(" ") : undefined;

  return {
    score: {
      scoreValue: Math.round(finalScoreValue),
      maxScore: 100,
      scoreLabel: scoreLabel,
    },
    contributingItems: contributingItemsFound,
    warningMessage: combinedWarningMessage,
  };
};
