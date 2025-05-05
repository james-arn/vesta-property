import {
  MAX_SCHOOL_DISTANCE_MILES,
  OFSTED_RATINGS_SCORES,
  SCHOOL_DISTANCE_WEIGHT_FACTOR,
} from "@/constants/scoreConstants";
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
