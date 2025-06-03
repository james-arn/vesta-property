import { CALCULATED_STATUS } from "@/constants/dashboardScoreCategoryConsts";
import {
  CategoryScoreData,
  DashboardScore,
  DataStatus,
  PropertyDataListItem,
} from "@/types/property";

// Helper function for score label (can be moved to a helper file if preferred)
const getListingCompletenessScoreLabel = (score: number): string => {
  if (score >= 95) return "Very Complete";
  if (score >= 80) return "Good Completeness";
  if (score >= 60) return "Average Completeness";
  if (score >= 40) return "Below Average";
  return "Poor Completeness";
};

export const calculateCompletenessScore = (items: PropertyDataListItem[]): CategoryScoreData => {
  // 2. Filter out items that are not applicable
  const applicableExpectedItems = items.filter((item) => item.status !== DataStatus.NOT_APPLICABLE);
  const applicableExpectedTotal = applicableExpectedItems.length;

  if (applicableExpectedTotal === 0) {
    // If no items are expected OR all expected items are N/A, consider it complete
    return {
      score: { scoreValue: 100, maxScore: 100, scoreLabel: "Fully Complete" },
      contributingItems: [],
      warningMessages: [],
      calculationStatus: CALCULATED_STATUS.CALCULATED,
    };
  }

  // 3. Count expected items where the status indicates missing info (ASK_AGENT)
  const missingExpectedItems = applicableExpectedItems.filter(
    (item) => item.status === DataStatus.ASK_AGENT
  );
  const missingExpectedCount = missingExpectedItems.length;

  // 4. Calculate the score
  const scoreValue =
    ((applicableExpectedTotal - missingExpectedCount) / applicableExpectedTotal) * 100;
  const finalScoreValue = Math.max(0, Math.min(100, Math.round(scoreValue)));
  const scoreLabel = getListingCompletenessScoreLabel(finalScoreValue);

  const finalScore: DashboardScore = {
    scoreValue: finalScoreValue,
    maxScore: 100,
    scoreLabel: scoreLabel,
  };

  const warningMessages: string[] = [];
  if (missingExpectedCount > 0) {
    warningMessages.push(`${missingExpectedCount} expected item(s) missing (marked 'Ask Agent').`);
  }

  return {
    score: finalScore,
    contributingItems: applicableExpectedItems,
    warningMessages: warningMessages,
    calculationStatus: CALCULATED_STATUS.CALCULATED,
  };
};
