import {
  CategoryScoreData,
  DashboardScore,
  DataStatus,
  PropertyDataListItem,
} from "@/types/property";

// Helper function for score label (can be moved to a helper file if preferred)
const getListingCompletenessScoreLabel = (score: number): string => {
  if (score >= 95) return "Complete";
  if (score >= 80) return "Mostly Complete";
  if (score >= 60) return "Missing Details";
  if (score >= 40) return "Incomplete";
  return "Very Incomplete";
};

export const calculateCompletenessScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  // 1. Filter for items expected in a standard listing
  const expectedItems = items.filter((item) => item.isExpectedInListing);

  // 2. Filter out items that are not applicable *from the expected list*
  const applicableExpectedItems = expectedItems.filter(
    (item) => item.status !== DataStatus.NOT_APPLICABLE
  );
  const applicableExpectedTotal = applicableExpectedItems.length;

  if (applicableExpectedTotal === 0) {
    // If no items are expected OR all expected items are N/A
    return {
      score: { scoreValue: 100, maxScore: 100, scoreLabel: "Very Complete" }, // Assume complete if nothing expected/applicable
      contributingItems: [],
      warningMessages: ["No applicable expected items found for completeness calculation."],
    };
  }

  // 3. Count expected items where the status indicates missing info (ASK_AGENT)
  const missingExpectedItems = applicableExpectedItems.filter(
    (item) => item.status === DataStatus.ASK_AGENT
  );
  const missingExpectedCount = missingExpectedItems.length;

  // 4. Calculate the score based on the proportion of *applicable expected items* that are present
  // Score = (Present Items / Total Applicable Expected Items) * 100
  const scoreValue =
    ((applicableExpectedTotal - missingExpectedCount) / applicableExpectedTotal) * 100;

  // Ensure score is within 0-100 bounds and round it
  const finalScoreValue = Math.max(0, Math.min(100, Math.round(scoreValue)));

  // Use the helper for the score label
  const scoreLabel = getListingCompletenessScoreLabel(finalScoreValue);

  const finalScore: DashboardScore = {
    scoreValue: finalScoreValue,
    maxScore: 100,
    scoreLabel: scoreLabel,
  };

  // Initialize warningMessages as an empty array
  const warningMessages: string[] = [];
  if (missingExpectedCount > 0) {
    // Add a warning if some expected items are missing
    warningMessages.push(
      `${missingExpectedCount} expected item(s) are missing from the listing or require agent input.`
    );
  }

  return {
    score: finalScore,
    // Items contributing negatively are the expected ones that are missing
    contributingItems: missingExpectedItems,
    warningMessages,
  };
};
