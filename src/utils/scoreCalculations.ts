import { CATEGORY_ITEM_MAP, DashboardScoreCategory } from "@/constants/dashboardConsts";
import {
  CategoryScoreData,
  DashboardScores,
  DataStatus,
  PropertyDataListItem,
} from "@/types/property";

// --- Helper Functions used only within this file ---
const findItem = (items: PropertyDataListItem[], key: string): PropertyDataListItem | undefined => {
  return items.find((item) => item.key === key);
};
const getItemValue = (item: PropertyDataListItem | undefined): any => {
  return item?.value;
};

// --- Mappers (Convert raw data to numeric scores) ---
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
const mapEpcToScore = (rating?: string | number | null): number => {
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
const mapTenureToRiskScore = (tenure?: string | null): number => {
  // Higher score = Higher Risk
  if (!tenure) return 50; // Neutral score if unknown
  const lowerTenure = tenure.toLowerCase();
  if (lowerTenure.includes("freehold")) return 0; // Lowest risk
  if (lowerTenure.includes("leasehold")) return 70; // Higher risk
  // Assign intermediate risk for others
  if (lowerTenure.includes("share of freehold") || lowerTenure.includes("commonhold")) return 10;
  return 50; // Default neutral score for other/unclear tenures
};

// --- Constants for Scoring Logic ---
const RUNNING_COSTS_WEIGHTS = {
  COUNCIL_TAX: 0.5,
  EPC: 0.3,
  TENURE: 0.2,
};

const TENURE_COST_SCORES = {
  LEASEHOLD: 60, // Higher cost score for leasehold
  UNKNOWN: 30, // Moderate cost score for unknown/check manually
  OTHER: 0, // Low cost score for freehold/other positive identifications
};

const DEFAULT_EPC_COST_SCORE = 50; // Equivalent to a 'D' rating

// --- Individual Category Score Calculations ---

const calculateRunningCostsScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  const contributingKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.RUNNING_COSTS] || [];
  const contributingItemsFound = items.filter((item) => contributingKeys.includes(item.key));

  const councilTaxItem = findItem(contributingItemsFound, "councilTax");
  const epcItem = findItem(contributingItemsFound, "epc");
  const tenureItem = findItem(contributingItemsFound, "tenure");

  // Council tax is essential for this score calculation approach
  if (!councilTaxItem || councilTaxItem.status === DataStatus.ASK_AGENT) {
    console.warn("Cannot calculate running costs score without valid council tax data.");
    return undefined;
  }

  const councilTaxValue = getItemValue(councilTaxItem);
  const epcValue = getItemValue(epcItem);
  const tenureValue = getItemValue(tenureItem);

  // Calculate individual cost scores (0-100, higher is more costly)
  const councilTaxCostScore = mapCouncilTaxToScore(councilTaxValue);
  const isValidEpcGrade = typeof epcValue === "string" && /^[A-G]\b/i.test(epcValue.trim());
  const epcEfficiencyScore = isValidEpcGrade
    ? mapEpcToScore(epcValue)
    : 100 - DEFAULT_EPC_COST_SCORE;
  const epcCostScore = 100 - epcEfficiencyScore;

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
    councilTaxCostScore * RUNNING_COSTS_WEIGHTS.COUNCIL_TAX +
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
  if (!isValidEpcGrade) {
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

const calculateRiskScore = (items: PropertyDataListItem[]): CategoryScoreData | undefined => {
  const contributingKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.RISK] || [];
  const contributingItems = items.filter((item) => contributingKeys.includes(item.key));
  if (contributingItems.length === 0) return undefined;

  const tenureItem = findItem(contributingItems, "tenure");
  // Use new mapper where higher score = higher risk
  const tenureRiskScore = mapTenureToRiskScore(getItemValue(tenureItem));

  // --- TODO: Incorporate other risk factors ---
  // Example: Add points for listedProperty, restrictions etc.
  // let totalRiskScore = tenureRiskScore;
  // const listedPropertyItem = findItem(contributingItems, "listedProperty");
  // if (listedPropertyItem?.status === DataStatus.FOUND_POSITIVE) { // Assuming FOUND_POSITIVE means 'Yes' for listed
  //     totalRiskScore += 15; // Add risk points if listed
  // }
  // const restrictionsItem = findItem(contributingItems, "restrictions");
  // if (restrictionsItem?.status === DataStatus.FOUND_POSITIVE) { // Assuming FOUND_POSITIVE means restrictions exist
  //     totalRiskScore += 10; // Add risk points for restrictions
  // }
  // --- End TODO ---

  // For now, just use tenure risk score, clamped 0-100
  const finalScoreValue = Math.max(0, Math.min(100, tenureRiskScore));

  // Adjust label function for direct risk score (higher number = higher risk)
  const getRiskLabel = (riskScore: number): string => {
    if (riskScore >= 65) return "High Risk"; // e.g. 65-100
    if (riskScore >= 50) return "Medium-High Risk"; // e.g. 50-64
    if (riskScore >= 35) return "Medium Risk"; // e.g. 35-49
    if (riskScore >= 20) return "Low-Medium Risk"; // e.g. 20-34
    return "Low Risk"; // e.g. 0-19
  };
  const scoreLabel = getRiskLabel(finalScoreValue);

  return {
    score: {
      scoreValue: Math.round(finalScoreValue),
      maxScore: 100,
      scoreLabel: scoreLabel,
    },
    contributingItems,
    // TODO: Add warnings based on specific risk factors found
  };
};

const calculateCompletenessScore = (
  allItems: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  const totalItems = allItems.length;
  if (totalItems === 0) return undefined;

  // Filter out items that don't have an askAgentMessage, as they aren't expected to be found
  const relevantItems = allItems.filter((item) => item.askAgentMessage);
  const relevantTotal = relevantItems.length;
  if (relevantTotal === 0)
    return {
      score: { scoreValue: 100, maxScore: 100, scoreLabel: "Very Complete" },
      contributingItems: [],
    }; // Avoid division by zero if no relevant items

  const askAgentItems = relevantItems.filter((item) => item.status === DataStatus.ASK_AGENT);
  const knownItems = relevantTotal - askAgentItems.length;
  const completenessPercentage = Math.round((knownItems / relevantTotal) * 100);

  const getCompletenessLabel = (percentage: number): string => {
    if (percentage >= 95) return "Very Complete";
    if (percentage >= 75) return "Mostly Complete";
    if (percentage < 50) return "Incomplete";
    return "Partially Complete";
  };
  const scoreLabel = getCompletenessLabel(completenessPercentage);

  return {
    contributingItems: askAgentItems, // Items contributing negatively (missing)
    score: {
      scoreValue: completenessPercentage,
      maxScore: 100,
      scoreLabel: scoreLabel,
    },
  };
};

// --- Placeholder Functions ---
// These need proper implementation based on defined logic and contributing factors
const calculateSafetyScore = (items: PropertyDataListItem[]): CategoryScoreData | undefined => {
  console.warn("Safety score calculation not implemented.");
  // Example placeholder: return a default score or undefined
  return undefined;
};
const calculateConditionScore = (items: PropertyDataListItem[]): CategoryScoreData | undefined => {
  console.warn("Condition score calculation not implemented.");
  return undefined;
};
const calculateValueForMoneyScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  console.warn("Value for Money score calculation not implemented.");
  return undefined;
};

// --- Main Orchestration Function ---
export const calculateDashboardScores = (
  checklistData: PropertyDataListItem[] | null
): DashboardScores => {
  if (!checklistData) return {};

  // Helper to get only items relevant to a specific category
  const getItemsForCategory = (category: DashboardScoreCategory): PropertyDataListItem[] => {
    const itemKeys = CATEGORY_ITEM_MAP[category] || [];
    // Filter checklistData based on the keys defined for the category
    return checklistData.filter((item) => itemKeys.includes(item.key));
  };

  // Calculate scores for each category
  const scores: DashboardScores = {
    [DashboardScoreCategory.RUNNING_COSTS]: calculateRunningCostsScore(
      getItemsForCategory(DashboardScoreCategory.RUNNING_COSTS)
    ),
    [DashboardScoreCategory.SAFETY]: calculateSafetyScore(
      getItemsForCategory(DashboardScoreCategory.SAFETY)
    ),
    [DashboardScoreCategory.CONDITION]: calculateConditionScore(
      getItemsForCategory(DashboardScoreCategory.CONDITION)
    ),
    [DashboardScoreCategory.VALUE_FOR_MONEY]: calculateValueForMoneyScore(
      getItemsForCategory(DashboardScoreCategory.VALUE_FOR_MONEY)
    ),
    [DashboardScoreCategory.RISK]: calculateRiskScore(
      getItemsForCategory(DashboardScoreCategory.RISK)
    ),
    // Completeness score uses all checklist items
    [DashboardScoreCategory.COMPLETENESS]: calculateCompletenessScore(checklistData),
  };

  // Filter out any categories where calculation resulted in undefined
  const finalScores = Object.entries(scores).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key as DashboardScoreCategory] = value;
    }
    return acc;
  }, {} as DashboardScores);

  return finalScores;
};
