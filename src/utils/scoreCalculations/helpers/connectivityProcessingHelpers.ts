import {
  MAX_SCHOOL_DISTANCE_MILES,
  OFSTED_RATINGS_SCORES,
  SCHOOL_DISTANCE_WEIGHT_FACTOR,
} from "@/constants/scoreConstants";
import { MobileServiceCoverageItem } from "@/types/premiumStreetData";
import { NearbySchool } from "@/types/property";

/**
 * Calculates a score component based on the nearest schools data.
 * Focuses on the best-rated school within a reasonable distance.
 * @param nearbySchoolsData - The array of NearbySchool objects.
 * @returns A score value (0-100), or null if no data.
 */
export const calculateNearbySchoolsScoreValue = (
  nearbySchoolsData: NearbySchool[] | undefined | null
): number | null => {
  if (!nearbySchoolsData || nearbySchoolsData.length === 0) {
    return 30; // Low score if no schools found/mentioned
  }

  const relevantSchools = nearbySchoolsData
    .filter(
      (school) =>
        school.distance !== null &&
        school.distance <= MAX_SCHOOL_DISTANCE_MILES &&
        school.ratingLabel &&
        school.ratingBody?.toLowerCase() === "ofsted" // Focus on Ofsted for now
    )
    .map((school) => {
      const ratingKey = school.ratingLabel!.toLowerCase();
      const baseScore = OFSTED_RATINGS_SCORES[ratingKey] ?? 30; // Default to low score if rating unknown

      // Apply distance penalty
      const normalizedDistance = Math.min(1, school.distance! / MAX_SCHOOL_DISTANCE_MILES);
      const distancePenalty = normalizedDistance * (1 - SCHOOL_DISTANCE_WEIGHT_FACTOR);
      const distanceAdjustedScore = baseScore * (1 - distancePenalty);

      return {
        ...school,
        calculatedScore: Math.max(0, Math.min(100, distanceAdjustedScore)),
      };
    });

  if (relevantSchools.length === 0) {
    return 40; // Slightly better than none, but no relevant (Ofsted-rated, close) schools
  }

  // Find the school with the highest calculated score
  const bestSchoolScore = relevantSchools.reduce(
    (maxScore, school) => Math.max(maxScore, school.calculatedScore),
    0
  );

  return bestSchoolScore;
};

const MOBILE_RATING_TO_SCORE_MULTIPLIER = 25; // 4 (max rating) * 25 = 100 (max score)
const DEFAULT_MOBILE_SCORE = 50;

export const calculateMobileCoverageScoreValue = (
  mobileCoverageData: MobileServiceCoverageItem[] | null | undefined
): number => {
  if (!mobileCoverageData) return DEFAULT_MOBILE_SCORE;

  const networkScores = mobileCoverageData.map((network) => {
    let sumOfScores = 0;
    let countOfScores = 0;

    // Prioritize 4G scores
    if (network.data_indoor_4g !== null) {
      sumOfScores += network.data_indoor_4g * MOBILE_RATING_TO_SCORE_MULTIPLIER;
      countOfScores++;
    }
    if (network.data_outdoor_4g !== null) {
      sumOfScores += network.data_outdoor_4g * MOBILE_RATING_TO_SCORE_MULTIPLIER;
      countOfScores++;
    }

    // If no 4G scores, use no-4G with a penalty
    if (countOfScores === 0) {
      if (network.data_indoor_no_4g !== null) {
        sumOfScores += network.data_indoor_no_4g * MOBILE_RATING_TO_SCORE_MULTIPLIER * 0.7; // 30% penalty
        countOfScores++;
      }
      if (network.data_outdoor_no_4g !== null) {
        sumOfScores += network.data_outdoor_no_4g * MOBILE_RATING_TO_SCORE_MULTIPLIER * 0.7; // 30% penalty
        countOfScores++;
      }
    }

    return countOfScores > 0 ? sumOfScores / countOfScores : 0; // Average score for this network
  });

  if (networkScores.length === 0) {
    return DEFAULT_MOBILE_SCORE;
  }

  // Return the score of the best network, or a default if all networks had no scorable data
  const bestNetworkScore = Math.max(...networkScores);
  return bestNetworkScore > 0 ? bestNetworkScore : DEFAULT_MOBILE_SCORE;
};
