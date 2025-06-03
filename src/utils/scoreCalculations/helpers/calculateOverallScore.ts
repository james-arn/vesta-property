import {
  CALCULATED_STATUS,
  DashboardScoreCategory,
} from "@/constants/dashboardScoreCategoryConsts";
import { DashboardScores } from "@/types/property";

/**
 * Calculates the overall property score by averaging the scores of relevant categories.
 * Excludes the LISTING_COMPLETENESS category.
 * Moved from dashboardHelpers.ts
 * @param scores - The dashboard scores object.
 * @returns The calculated overall score (0-100) or null if no relevant scores are available.
 */
const calculateOverallScore = (scores: DashboardScores): number | null => {
  const relevantScores = Object.entries(scores)
    // Filter using constant
    .filter(
      ([key, data]) =>
        key !== DashboardScoreCategory.DATA_COVERAGE &&
        data?.calculationStatus === CALCULATED_STATUS.CALCULATED && // Use constant
        data.score !== null
    )
    // Map to the scoreValue, handling potential nulls within the score object
    .map(([, data]): number | null => data.score!.scoreValue ?? null)
    // Filter out null or NaN score values
    .filter((scoreValue): scoreValue is number => scoreValue !== null && !isNaN(scoreValue));

  if (relevantScores.length === 0) {
    // Return null if no categories were successfully calculated
    return null;
  }

  const sum = relevantScores.reduce((acc, scoreValue) => acc + scoreValue, 0);
  return Math.round(sum / relevantScores.length);
};

export default calculateOverallScore;
