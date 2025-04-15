import { MAX_SCORE, RUNNING_COSTS_WEIGHTS, TENURE_COST_SCORES } from "@/constants/scoreConstants";
import {
  CategoryScoreData,
  DataStatus,
  PreprocessedData,
  PropertyDataListItem,
} from "@/types/property";
import { findItemByKey, getItemValue } from "@/utils/parsingHelpers";
import { calculateEpcScoreValue } from "./scoreCalculationHelpers"; // Import the helper

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
  const defaultScore = 50; // Default score if band is unknown or not standard
  return typeof band === "string"
    ? (bandMap[band.trim().toUpperCase()] ?? defaultScore)
    : defaultScore;
};

export const calculateRunningCostsScore = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData // Use PreprocessedData
): CategoryScoreData | undefined => {
  const councilTaxItem = findItemByKey(items, "councilTax");
  const epcItem = findItemByKey(items, "epc");
  const tenureItem = findItemByKey(items, "tenure");
  const heatingItem = findItemByKey(items, "heatingType"); // Keep track of heating

  // If essential data (like EPC score from preprocessed) is missing, we might return undefined or a default score
  if (
    preprocessedData.epcScoreForCalculation === null ||
    preprocessedData.epcScoreForCalculation === undefined
  ) {
    console.warn("EPC score for calculation is missing in preprocessedData.");
    // Decide handling: return undefined or a default score with warning?
    // Let's return a score indicating uncertainty
    // Collect available items
    const contributingItems = [councilTaxItem, epcItem, tenureItem, heatingItem].filter(
      Boolean
    ) as PropertyDataListItem[];
    return {
      score: { scoreValue: 50, maxScore: MAX_SCORE, scoreLabel: "Running Costs Uncertain" },
      contributingItems,
      warningMessage: "EPC data missing, Running Costs score is an estimate.",
    };
  }

  // Calculate score components
  const epcEfficiencyScore = calculateEpcScoreValue(preprocessedData.epcScoreForCalculation); // Use helper
  const epcCostScore = MAX_SCORE - epcEfficiencyScore; // Invert: higher efficiency = lower cost score

  const councilTaxValue = getItemValue(councilTaxItem);
  const councilTaxCostScore = mapCouncilTaxToScore(councilTaxValue);

  const tenureValue = getItemValue(tenureItem);
  const getTenureCostScore = (): number => {
    if (
      !tenureItem ||
      tenureItem.status === DataStatus.ASK_AGENT ||
      tenureItem.status === DataStatus.IS_LOADING
    ) {
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

  // --- TODO: Add Heating Cost Score ---
  // const heatingCostScore = calculateHeatingCostScore(heatingItem);
  // Update weights if adding heating
  const heatingCostScore = 0; // Placeholder

  // Calculate weighted total cost score (higher = more costly)
  // Adjust weights if adding more factors like heating
  const totalCostScore =
    councilTaxCostScore * RUNNING_COSTS_WEIGHTS.COUNCIL_TAX +
    epcCostScore * RUNNING_COSTS_WEIGHTS.EPC +
    tenureCostScore * RUNNING_COSTS_WEIGHTS.TENURE;
  // + heatingCostScore * WEIGHTS.HEATING; // Add when implemented

  // Normalize final score (0-100, higher cost score is worse)
  const finalScoreValue = Math.max(0, Math.min(MAX_SCORE, Math.round(totalCostScore)));

  // Determine Score Label based on the *cost* score
  const getRunningCostScoreLabel = (costScore: number): string => {
    if (costScore >= 65) return "High Cost";
    if (costScore >= 50) return "Medium-High Cost";
    if (costScore >= 35) return "Medium Cost";
    if (costScore >= 20) return "Low-Medium Cost";
    return "Low Cost";
  };
  const scoreLabel = getRunningCostScoreLabel(finalScoreValue);

  // Generate Warnings
  const warnings: string[] = [];
  if (epcItem?.status === DataStatus.ASK_AGENT) {
    warnings.push("EPC rating was estimated.");
  }
  if (councilTaxItem?.status !== DataStatus.FOUND_POSITIVE) {
    warnings.push("Council Tax band unknown, cost estimated.");
  }
  if (
    !tenureItem ||
    tenureItem.status === DataStatus.ASK_AGENT ||
    tenureItem.status === DataStatus.IS_LOADING
  ) {
    warnings.push(
      "Tenure could not be confirmed. Leasehold properties may incur additional costs."
    );
  } else if (tenureCostScore === TENURE_COST_SCORES.LEASEHOLD) {
    // Add leasehold specific warning, possibly using calculatedLeaseMonths from preprocessedData
    const leaseMonths = preprocessedData.calculatedLeaseMonths;
    const leaseWarningBase = "Leasehold: Additional costs (ground rent, service charges) likely.";
    const leaseTermWarning =
      leaseMonths !== null && leaseMonths < 80 * 12 // Check if less than 80 years
        ? ` Lease term (${Math.round(leaseMonths / 12)} years) is relatively short, which might affect mortgageability and future value.`
        : "";
    warnings.push(leaseWarningBase + leaseTermWarning);
  }
  // Add heating warnings when implemented

  const combinedWarningMessage = warnings.length > 0 ? warnings.join(" ") : undefined;

  // Collect contributing items
  const contributingItems = [councilTaxItem, epcItem, tenureItem, heatingItem].filter(
    Boolean
  ) as PropertyDataListItem[];

  return {
    score: {
      scoreValue: finalScoreValue, // This is the COST score
      maxScore: MAX_SCORE,
      scoreLabel: scoreLabel,
    },
    contributingItems,
    warningMessage: combinedWarningMessage,
  };
};
