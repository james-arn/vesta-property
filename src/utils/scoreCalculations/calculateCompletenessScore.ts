import { CategoryScoreData, DataStatus, PropertyDataListItem } from "@/types/property"; // Adjust path as needed

export const calculateCompletenessScore = (
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
