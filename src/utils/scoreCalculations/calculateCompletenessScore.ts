import {
  CategoryScoreData,
  DashboardScore,
  DataStatus,
  PreprocessedData,
  PropertyDataListItem,
} from "@/types/property";

// Helper function for score label (can be moved to a helper file if preferred)
const getListingCompletenessScoreLabel = (score: number): string => {
  if (score >= 95) return "Very Complete";
  if (score >= 80) return "Mostly Complete";
  if (score >= 60) return "Partially Complete";
  if (score >= 40) return "Somewhat Incomplete";
  return "Very Incomplete";
};

export const calculateCompletenessScore = (
  items: PropertyDataListItem[],
  // Add preprocessedData parameter for consistency with other calculators
  preprocessedData: PreprocessedData
): CategoryScoreData | undefined => {
  // Filter out items that are not applicable
  const applicableItems = items.filter((item) => item.status !== DataStatus.NOT_APPLICABLE);
  const applicableTotal = applicableItems.length;

  if (applicableTotal === 0) {
    // Cannot calculate if there are no applicable items
    // Return a default high score or undefined based on desired behavior
    return {
      score: { scoreValue: 100, maxScore: 100, scoreLabel: "Very Complete" },
      contributingItems: [],
      warningMessage: "No applicable items found for completeness calculation.",
    };
  }

  // Count items where the status is ASK_AGENT among applicable items
  const askAgentItems = applicableItems.filter((item) => item.status === DataStatus.ASK_AGENT);
  const askAgentCount = askAgentItems.length;

  // Calculate the score: 100% minus the percentage of applicable items needing agent input
  const scoreValue = 100 - (askAgentCount / applicableTotal) * 100;

  // Ensure score is within 0-100 bounds and round it
  const finalScoreValue = Math.max(0, Math.min(100, Math.round(scoreValue)));

  // Use the helper for the score label
  const scoreLabel = getListingCompletenessScoreLabel(finalScoreValue);

  const finalScore: DashboardScore = {
    scoreValue: finalScoreValue,
    maxScore: 100,
    scoreLabel: scoreLabel,
  };

  let warningMessage: string | undefined = undefined;
  if (askAgentCount > 0) {
    warningMessage = `${askAgentCount} applicable item(s) require contacting the agent for information.`;
  }

  return {
    score: finalScore,
    // Items contributing negatively (requiring agent input)
    contributingItems: askAgentItems,
    warningMessage: warningMessage,
  };
};
