import { DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import { CategoryScoreData, DashboardScores } from "@/types/property";

/**
 * Calculates the overall property score by averaging the scores of relevant categories.
 * Excludes the LISTING_COMPLETENESS category.
 * @param scores - The dashboard scores object.
 * @returns The calculated overall score (0-100) or null if no relevant scores are available.
 */
export const calculateOverallScore = (scores: DashboardScores): number | null => {
  const relevantScores = Object.entries(scores)
    .filter(([key]) => key !== DashboardScoreCategory.DATA_COVERAGE)
    // Map to the nested scoreValue, handling potential nulls
    .map((entry: [string, CategoryScoreData]): number | null => entry[1].score?.scoreValue ?? null)
    // Filter out null or NaN scores
    .filter((scoreValue): scoreValue is number => scoreValue !== null && !isNaN(scoreValue));

  // Return null if no valid scores to average
  if (relevantScores.length === 0) {
    return null;
  }

  // Calculate the average score
  const sum = relevantScores.reduce((acc, scoreValue) => acc + scoreValue, 0);
  return Math.round(sum / relevantScores.length);
};
