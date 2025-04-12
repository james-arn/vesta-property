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
  // Higher score = Higher Risk/Constraint Level
  if (!tenure) return 50;
  const lowerTenure = tenure.toLowerCase();
  if (lowerTenure.includes("freehold")) return 0; // Low constraint/risk
  if (lowerTenure.includes("leasehold")) return 70; // High constraint/risk
  if (lowerTenure.includes("share of freehold") || lowerTenure.includes("commonhold")) return 10; // Low-ish constraint
  return 50;
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

const calculateInvestmentValueScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  console.warn("Investment Value score calculation not implemented.");
  // TODO: Implement logic comparing price, estimates, trends etc.
  // Placeholder: return a neutral score
  return {
    score: { scoreValue: 50, maxScore: 100, scoreLabel: "Medium Value" },
    contributingItems: items,
  };
};

const calculateConnectivityScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  console.warn("Connectivity score calculation not implemented.");
  // TODO: Implement logic based on broadband, mobile coverage, proximity etc.
  // Placeholder: return a neutral score
  return {
    score: { scoreValue: 50, maxScore: 100, scoreLabel: "Medium Connectivity" },
    contributingItems: items,
  };
};

const calculateConditionScore = (items: PropertyDataListItem[]): CategoryScoreData | undefined => {
  console.warn("Condition score calculation not implemented.");
  // TODO: Implement logic based on age, materials, EPC, known issues etc.
  // Placeholder: return a neutral score
  return {
    score: { scoreValue: 50, maxScore: 100, scoreLabel: "Medium Condition" },
    contributingItems: items,
  };
};

const calculateEnvironmentalRiskScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  console.warn("Environmental Risk score calculation needs implementation beyond placeholders.");
  // TODO: Implement logic summing risk points from flood, crime, noise, etc.
  const crimeItem = findItem(items, "crimeScore");
  // ... get other relevant items ...
  let totalRiskPoints = 0;
  // Add points based on crime score value, flood status, etc.
  // Example: if crime score is high, add points.

  const finalScoreValue = Math.max(0, Math.min(100, totalRiskPoints)); // Higher score = higher risk

  const getEnvironmentalRiskLabel = (riskScore: number): string => {
    if (riskScore >= 65) return "High Risk";
    if (riskScore >= 50) return "Medium-High Risk";
    if (riskScore >= 35) return "Medium Risk";
    if (riskScore >= 20) return "Low-Medium Risk";
    return "Low Risk";
  };
  const scoreLabel = getEnvironmentalRiskLabel(finalScoreValue);

  return {
    score: { scoreValue: Math.round(finalScoreValue), maxScore: 100, scoreLabel },
    contributingItems: items,
  };
};

const calculateLegalConstraintsScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  console.warn("Legal Constraints score calculation needs implementation beyond placeholders.");
  // TODO: Implement logic summing constraint points from tenure, listed status, restrictions etc.
  const tenureItem = findItem(items, "tenure");
  let totalConstraintPoints = mapTenureToRiskScore(getItemValue(tenureItem)); // Start with tenure points
  // ... check listedProperty, restrictions, lease term < 80, etc. and add points ...

  const finalScoreValue = Math.max(0, Math.min(100, totalConstraintPoints)); // Higher score = more constraints

  const getLegalConstraintsLabel = (constraintScore: number): string => {
    if (constraintScore >= 65) return "Severe Constraints";
    if (constraintScore >= 50) return "Medium-High Constraints";
    if (constraintScore >= 35) return "Medium Constraints";
    if (constraintScore >= 20) return "Low-Medium Constraints";
    return "Low Constraints";
  };
  const scoreLabel = getLegalConstraintsLabel(finalScoreValue);

  return {
    score: { scoreValue: Math.round(finalScoreValue), maxScore: 100, scoreLabel },
    contributingItems: items,
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
    [DashboardScoreCategory.INVESTMENT_VALUE]: calculateInvestmentValueScore(
      getItemsForCategory(DashboardScoreCategory.INVESTMENT_VALUE)
    ),
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
      getItemsForCategory(DashboardScoreCategory.LEGAL_CONSTRAINTS)
    ),
    [DashboardScoreCategory.LISTING_COMPLETENESS]: calculateCompletenessScore(checklistData),
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
