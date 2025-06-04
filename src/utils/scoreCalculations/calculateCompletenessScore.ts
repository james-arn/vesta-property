import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { CALCULATED_STATUS } from "@/constants/dashboardScoreCategoryConsts";
import { CategoryScoreData, DashboardScore, PropertyDataListItem } from "@/types/property";

// Helper function for score label (can be moved to a helper file if preferred)
const getListingCompletenessScoreLabel = (score: number): string => {
  if (score >= 95) return "Very Complete";
  if (score >= 80) return "Good Completeness";
  if (score >= 60) return "Average Completeness";
  if (score >= 40) return "Below Average";
  return "Poor Completeness";
};

export const calculateCompletenessScore = (items: PropertyDataListItem[]): CategoryScoreData => {
  // 1. Filter out items that are not applicable
  const [completedItems, missingItems] = items.reduce<
    [PropertyDataListItem[], PropertyDataListItem[]]
  >(
    ([completed, missing], item) => {
      const isMissing = Object.values(CHECKLIST_NO_VALUE).some(
        (noValue) => noValue.toLowerCase() === String(item.value).toLowerCase()
      );
      return isMissing ? [completed, [...missing, item]] : [[...completed, item], missing];
    },
    [[], []]
  );
  const completedTotal = completedItems.length;

  if (completedTotal === 0) {
    // If no items are expected OR all expected items are N/A, consider it complete
    return {
      score: { scoreValue: 100, maxScore: 100, scoreLabel: "Fully Complete" },
      contributingItems: [],
      warningMessages: [],
      calculationStatus: CALCULATED_STATUS.CALCULATED,
    };
  }

  const totalItems = items.length;

  // 2. Calculate the score
  const scoreValue = (completedTotal / totalItems) * 100;
  const finalScoreValue = Math.max(0, Math.min(100, Math.round(scoreValue)));
  const scoreLabel = getListingCompletenessScoreLabel(finalScoreValue);

  const finalScore: DashboardScore = {
    scoreValue: finalScoreValue,
    maxScore: 100,
    scoreLabel: scoreLabel,
  };

  return {
    score: finalScore,
    contributingItems: completedItems,
    warningMessages: [],
    calculationStatus: CALCULATED_STATUS.CALCULATED,
  };
};
