import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { CATEGORY_ITEM_MAP, DASHBOARD_CATEGORY_DISPLAY_NAMES, DashboardScoreCategory } from "@/constants/dashboardConsts";
import { isClickableItemKey } from "@/types/clickableChecklist";
import { logErrorToSentry } from "@/utils/sentry";
import React from 'react';
import { CategoryScoreData, DashboardScores, DataStatus, PropertyDataListItem } from "../types/property";

export const getStatusIcon = (status: DataStatus): string | React.ReactNode => {
  switch (status) {
    case DataStatus.FOUND_POSITIVE:
      return "✅";
    case DataStatus.FOUND_NEGATIVE:
      return "❌";
    case DataStatus.ASK_AGENT:
      return "⚠️";
    case DataStatus.IS_LOADING:
      return <LoadingSpinner />
    case DataStatus.NOT_APPLICABLE:
      return "➖";
  }
};

export const getStatusColor = (status: DataStatus): string => {
  switch (status) {
    case DataStatus.FOUND_POSITIVE:
      return "green";
    case DataStatus.FOUND_NEGATIVE:
      return "red";
    case DataStatus.ASK_AGENT:
      return "orange";
    case DataStatus.IS_LOADING:
      return "gray";
    case DataStatus.NOT_APPLICABLE:
      return "black";
  }
};

export const filterChecklistToAllAskAgentOnlyItems = (
  checklist: PropertyDataListItem[]
): PropertyDataListItem[] => {
  return checklist.filter((item) => item.status === DataStatus.ASK_AGENT);
};

export function extractPropertyIdFromUrl(url: string): string | undefined {
  try {
    const parsedUrl = new URL(url);

    // Only process URLs that belong to a Rightmove domain.
    // This check ensures that even if there is a 'backToPropertyURL' query parameter,
    // we ignore it if the main URL is not from rightmove.
    if (!parsedUrl.hostname.endsWith("rightmove.co.uk")) {
      return undefined;
    }

    // Try to get propertyId from the query parameter.
    let propertyId = parsedUrl.searchParams.get("propertyId");
    if (propertyId) return propertyId;

    // Optionally, check a secondary parameter like backToPropertyURL.
    const backToPropertyURL = parsedUrl.searchParams.get("backToPropertyURL");
    if (backToPropertyURL) {
      const backUrl = new URL(backToPropertyURL, parsedUrl.origin);
      propertyId = backUrl.pathname.split("/").pop() ?? null;
      if (propertyId) return propertyId;
    }

    // Fallback: extract from the pathname (e.g. /properties/<id>).
    const pathMatch = parsedUrl.pathname.match(/\/properties\/(\d+)/);
    if (pathMatch) return pathMatch[1];
  } catch (error) {
    logErrorToSentry("Invalid URL in extractPropertyIdFromUrl: " + error);
  }
  return undefined;
}

export const getValueClickHandler = (
  item: PropertyDataListItem,
  openNewTab: (url: string) => void,
  toggleCrimeChart: () => void,
  togglePlanningPermissionCard: () => void,
  toggleNearbyPlanningPermissionCard?: () => void): (() => void) | undefined => {

  const { key, value } = item;
  if (!isClickableItemKey(key)) return undefined;

  switch (key) {
    case "epc":
    case "floorPlan":
      return () => openNewTab(String(value));
    case "crimeScore":
      return toggleCrimeChart;
    case "planningPermissions":
      return togglePlanningPermissionCard;
    case "nearbyPlanningPermissions":
      return toggleNearbyPlanningPermissionCard || (() => console.error("No handler for nearbyPlanningPermissions"));
    default:
      console.error(`Key "${key}" is defined as clickable but not handled in switch statement`);
      return undefined;
  }
};

export const generateAgentMessage = (checklist: PropertyDataListItem[]): string => {
  const askAgentItems = checklist.filter(
    (item) => item.status === DataStatus.ASK_AGENT && item.askAgentMessage
  );
  if (askAgentItems.length === 0) {
    return "No missing items identified to ask the agent about.";
  }
  const questions = askAgentItems.map((item) => `- ${item.askAgentMessage}`).join("\n");
  return `Regarding the property listing, could you please provide information on the following points?\n\n${questions}\n\nThank you.`;
};

// --- Helper Functions for Scoring ---
const findItem = (items: PropertyDataListItem[], key: string): PropertyDataListItem | undefined => {
  return items.find((item) => item.key === key);
};
const getItemValue = (item: PropertyDataListItem | undefined): any => {
  return item?.value;
};

// --- Mappers (Convert raw data to numeric scores) ---
const mapCouncilTaxToScore = (band?: string | null): number => {
  /* ... as defined previously ... */
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
  return typeof band === "string" ? (bandMap[band.toUpperCase()] ?? 50) : 50;
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
  return averageScore;
};
const mapTenureToScore = (tenure?: string | null): number => {
  /* ... as defined previously ... */
  if (!tenure) return 50;
  const lowerTenure = tenure.toLowerCase();
  if (lowerTenure.includes("freehold")) return 100;
  if (lowerTenure.includes("leasehold")) return 30;
  return 50;
};

// Constants for the running costs calculation
const RUNNING_COSTS_WEIGHTS = {
  COUNCIL_TAX: 0.5,
  EPC: 0.3,
  TENURE: 0.2,
};

const TENURE_COST_SCORES = {
  LEASEHOLD: 60, // Higher cost score for leasehold
  UNKNOWN: 30,   // Moderate cost score for unknown/check manually
  OTHER: 0,      // Low cost score for freehold/other positive identifications
};

const DEFAULT_EPC_COST_SCORE = 50; // Equivalent to a 'D' rating

const calculateRunningCostsScore = (items: PropertyDataListItem[]): CategoryScoreData | undefined => {
  const contributingKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.RUNNING_COSTS] || [];
  // Ensure we only work with items relevant to this category
  const contributingItemsFound = items.filter((item) => contributingKeys.includes(item.key));

  const councilTaxItem = findItem(contributingItemsFound, "councilTax");
  const epcItem = findItem(contributingItemsFound, "epc");
  const tenureItem = findItem(contributingItemsFound, "tenure"); // Added tenure item

  // Council tax is essential for this score
  if (!councilTaxItem || councilTaxItem.status === DataStatus.ASK_AGENT) {
    // Return undefined or a default state if council tax is missing/unverified
    // For now, returning undefined seems appropriate as it's a key component.
    // Alternatively, could return a score with a clear warning about missing crucial data.
    console.warn("Cannot calculate running costs score without valid council tax data.");
    return undefined; // Or handle differently if a partial score is desired
  }

  const councilTaxValue = getItemValue(councilTaxItem);
  const epcValue = getItemValue(epcItem);
  const tenureValue = getItemValue(tenureItem);

  // 1. Calculate individual cost scores (0-100, higher is more costly)
  const councilTaxCostScore = mapCouncilTaxToScore(councilTaxValue); // Assumes this returns 0-100 cost score

  const isValidEpcGrade = typeof epcValue === 'string' && /^[A-G]\b/i.test(epcValue.trim());
  const epcEfficiencyScore = isValidEpcGrade ? mapEpcToScore(epcValue) : (100 - DEFAULT_EPC_COST_SCORE); // mapEpcToScore gives efficiency, higher is better
  const epcCostScore = 100 - epcEfficiencyScore; // Invert efficiency to get cost score

  const getTenureCostScore = (): number => {
    if (!tenureItem || tenureItem.status === DataStatus.ASK_AGENT) {
      return TENURE_COST_SCORES.UNKNOWN;
    }
    if (tenureItem.status === DataStatus.FOUND_POSITIVE && typeof tenureValue === 'string') {
      return tenureValue.toLowerCase().includes('leasehold')
        ? TENURE_COST_SCORES.LEASEHOLD
        : TENURE_COST_SCORES.OTHER; // Assumes non-leasehold positive is low cost (Freehold etc.)
    }
    return TENURE_COST_SCORES.UNKNOWN; // Default for unexpected statuses
  };
  const tenureCostScore = getTenureCostScore();


  // 2. Calculate weighted total cost score
  const totalCostScore =
    (councilTaxCostScore * RUNNING_COSTS_WEIGHTS.COUNCIL_TAX) +
    (epcCostScore * RUNNING_COSTS_WEIGHTS.EPC) +
    (tenureCostScore * RUNNING_COSTS_WEIGHTS.TENURE);

  // 3. Calculate final score (higher is better/lower cost) and clamp
  const finalScoreValue = Math.max(0, Math.min(100, 100 - totalCostScore));

  // 4. Determine label
  const getScoreLabel = (score: number): string => {
    if (score > 75) return "Low Cost";
    if (score < 40) return "High Cost";
    return "Medium Cost";
  };
  const scoreLabel = getScoreLabel(finalScoreValue);

  // 5. Generate Warnings
  const warnings: string[] = [];
  if (!isValidEpcGrade) {
    warnings.push("EPC rating not found or invalid; score calculated using UK average (D).");
  }
  if (!tenureItem || tenureItem.status === DataStatus.ASK_AGENT) {
    warnings.push("Tenure could not be confirmed automatically. Leasehold properties may incur additional costs.");
  } else if (tenureCostScore === TENURE_COST_SCORES.LEASEHOLD) {
    warnings.push("Leasehold tenure typically involves additional costs (e.g., ground rent, service charges).");
  }
  const combinedWarningMessage = warnings.length > 0 ? warnings.join(" ") : undefined;


  // 6. Return Structure
  return {
    score: {
      scoreValue: Math.round(finalScoreValue),
      maxScore: 100,
      scoreLabel: scoreLabel,
    },
    contributingItems: contributingItemsFound, // Return all items used in calculation
    warningMessage: combinedWarningMessage,
  };
};

const calculateRiskScore = (items: PropertyDataListItem[]): CategoryScoreData | undefined => {
  const contributingKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.RISK] || [];
  const contributingItems = items.filter((item) => contributingKeys.includes(item.key));
  if (contributingItems.length === 0) return undefined;
  const tenureItem = findItem(contributingItems, "tenure");
  const tenureScore = mapTenureToScore(getItemValue(tenureItem));
  const finalScoreValue = tenureScore;
  let label = "Medium Risk";
  if (finalScoreValue > 75) label = "Low Risk";
  else if (finalScoreValue < 40) label = "High Risk";
  return {
    score: { scoreValue: Math.round(finalScoreValue), maxScore: 100, scoreLabel: label },
    contributingItems,
  };
};

const calculateCompletenessScore = (
  allItems: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  const totalItems = allItems.length;
  if (totalItems === 0) return undefined;
  const askAgentItems = allItems.filter((item) => item.status === DataStatus.ASK_AGENT);
  const knownItems = totalItems - askAgentItems.length;
  const completenessPercentage = Math.round((knownItems / totalItems) * 100);
  let label = "Partially Complete";
  if (completenessPercentage > 95) label = "Very Complete";
  else if (completenessPercentage > 75) label = "Mostly Complete";
  else if (completenessPercentage < 50) label = "Incomplete";
  return {
    contributingItems: askAgentItems,
    score: { scoreValue: completenessPercentage, maxScore: 100, scoreLabel: label },
  };
};

// Placeholder functions - NEED IMPLEMENTATION
const calculateSafetyScore = (items: PropertyDataListItem[]): CategoryScoreData | undefined => {
  console.warn("Safety score calculation not implemented.");
  return undefined;
};
const calculateConditionScore = (items: PropertyDataListItem[]): CategoryScoreData | undefined => {
  console.warn("Condition score calculation not implemented.");
  return undefined;
};
const calculateValueForMoneyScore = (items: PropertyDataListItem[]): CategoryScoreData | undefined => {
  console.warn("Value for Money score calculation not implemented.");
  return undefined;
};

export const calculateDashboardScores = (
  checklistData: PropertyDataListItem[] | null
): DashboardScores => {
  if (!checklistData) return {};
  const getItemsForCategory = (category: DashboardScoreCategory): PropertyDataListItem[] => {
    const itemKeys = CATEGORY_ITEM_MAP[category] || [];
    return checklistData.filter((item) => itemKeys.includes(item.key));
  };
  return {
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
    [DashboardScoreCategory.COMPLETENESS]: calculateCompletenessScore(checklistData),
  };
};

// --- Helper to get display name ---
export const getCategoryDisplayName = (category: DashboardScoreCategory): string => {
  return DASHBOARD_CATEGORY_DISPLAY_NAMES[category] || category.replace(/_/g, " ");
};
