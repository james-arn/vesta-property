import { FOUND_STATIONS_SCORE, MAX_SCORE, NO_STATIONS_SCORE } from "@/constants/scoreConstants";
import {
  CategoryScoreData,
  DataStatus,
  NearbySchool,
  PreprocessedData,
  PropertyDataListItem,
} from "@/types/property";
import { findItemByKey } from "@/utils/parsingHelpers";

// --- Constants --- //
const OFSTED_RATINGS_SCORES: { [key: string]: number } = {
  outstanding: 100,
  good: 75,
  "requires improvement": 40,
  inadequate: 20,
};

const MAX_SCHOOL_DISTANCE_MILES = 1.5; // Schools beyond this distance have minimal impact
const SCHOOL_DISTANCE_WEIGHT_FACTOR = 0.7; // How much distance affects score (lower = less effect)

// --- Station Scoring --- //
/**
 * Calculates a score component based on the nearest stations data.
 * @param nearestStationsItem - The checklist item for nearest stations.
 * @returns A score value (0-100) based on station presence.
 */
const calculateStationScoreValue = (
  nearestStationsItem: PropertyDataListItem | undefined
): number => {
  if (!nearestStationsItem) {
    console.warn("Nearest stations item not found for connectivity score.");
    return NO_STATIONS_SCORE;
  }

  switch (nearestStationsItem.status) {
    case DataStatus.FOUND_POSITIVE:
      return FOUND_STATIONS_SCORE;
    case DataStatus.ASK_AGENT:
    case DataStatus.FOUND_NEGATIVE: // Treat negative finding same as ask agent for score
      return NO_STATIONS_SCORE;
    case DataStatus.IS_LOADING:
    case DataStatus.NOT_APPLICABLE:
    default:
      return (FOUND_STATIONS_SCORE + NO_STATIONS_SCORE) / 2; // Mid-point for neutral/loading
  }
};

// --- Broadband Scoring (Placeholder) --- //
// TODO: Implement actual broadband scoring based on speed
const calculateBroadbandScoreValue = (broadbandItem: PropertyDataListItem | undefined): number => {
  if (!broadbandItem || broadbandItem.status !== DataStatus.FOUND_POSITIVE) {
    return 50; // Default/neutral score if no data or negative
  }
  // Basic placeholder: Assume positive finding is good for now
  return 80;
};

// --- School Scoring --- //
/**
 * Calculates a score component based on the nearest schools data.
 * Focuses on the best-rated school within a reasonable distance.
 * @param nearbySchoolsData - The raw array of NearbySchool objects.
 * @returns A score value (0-100).
 */
const calculateNearbySchoolsScoreValue = (
  nearbySchoolsData: NearbySchool[] | undefined
): number => {
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

      // Apply distance penalty: score decreases as distance increases
      // Normalize distance to 0-1 range (0 = at property, 1 = max distance)
      const normalizedDistance = Math.min(1, school.distance! / MAX_SCHOOL_DISTANCE_MILES);
      // Simple linear decay based on distance weight
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

// --- Combined Score --- //
const calculateCombinedConnectivityScore = (
  stationScoreValue: number,
  broadbandScoreValue: number,
  schoolsScoreValue: number | null,
  nearestStationsItem: PropertyDataListItem | undefined,
  broadbandItem: PropertyDataListItem | undefined,
  schoolsItem: PropertyDataListItem | undefined
): { combinedScoreValue: number; scoreLabel: string; warningMessage?: string } => {
  // --- Weighting --- (Adjust as needed)
  const stationWeight = 0.5;
  const broadbandWeight = 0.2;
  const schoolsWeight = 0.3;
  // const mobileCoverageWeight = 0.0; // Add when data available

  // Handle null school score - treat as a neutral score (e.g., 50) for calculation
  const effectiveSchoolsScore = schoolsScoreValue ?? 50;

  const weightedScore =
    stationScoreValue * stationWeight +
    broadbandScoreValue * broadbandWeight +
    effectiveSchoolsScore * schoolsWeight;
  // + (mobileScore * mobileCoverageWeight);

  // Ensure score is within 0-100
  const combinedScoreValue = Math.max(0, Math.min(MAX_SCORE, Math.round(weightedScore)));

  // --- Determine Label --- //
  const CONNECTIVITY_SCORE_THRESHOLDS = {
    EXCELLENT: 90,
    VERY_GOOD: 80,
    GOOD: 70,
    ABOVE_AVERAGE: 60,
    AVERAGE: 50,
    BELOW_AVERAGE: 40,
    POOR: 30,
    VERY_POOR: 20,
  } as const;

  let scoreLabel = "Average Connectivity";

  if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.EXCELLENT) {
    scoreLabel = "Excellent Connectivity";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.VERY_GOOD) {
    scoreLabel = "Very Good Connectivity";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.GOOD) {
    scoreLabel = "Good Connectivity";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.ABOVE_AVERAGE) {
    scoreLabel = "Above Average Connectivity";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.AVERAGE) {
    scoreLabel = "Average Connectivity";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.BELOW_AVERAGE) {
    scoreLabel = "Below Average Connectivity";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.POOR) {
    scoreLabel = "Poor Connectivity";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.VERY_POOR) {
    scoreLabel = "Very Poor Connectivity";
  } else {
    scoreLabel = "Extremely Poor Connectivity";
  }

  // --- Generate Warning --- //
  let warningParts: string[] = [];
  if (
    !nearestStationsItem ||
    [DataStatus.ASK_AGENT, DataStatus.FOUND_NEGATIVE, DataStatus.IS_LOADING].includes(
      nearestStationsItem.status
    )
  ) {
    warningParts.push("Station data limited/unavailable.");
  }
  if (!broadbandItem || broadbandItem.status !== DataStatus.FOUND_POSITIVE) {
    warningParts.push("Broadband speed unknown/unavailable.");
  }
  if (
    !schoolsItem ||
    [DataStatus.ASK_AGENT, DataStatus.FOUND_NEGATIVE, DataStatus.IS_LOADING].includes(
      schoolsItem.status
    )
  ) {
    warningParts.push("School data limited/unavailable.");
  }
  const warningMessage = warningParts.length > 0 ? warningParts.join(" ") : undefined;

  return { combinedScoreValue, scoreLabel, warningMessage };
};

// --- Overall Connectivity Score --- //
const calculateConnectivityScore = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData
): CategoryScoreData | undefined => {
  const nearestStationsItem = findItemByKey(items, "nearestStations");
  const broadbandItem = findItemByKey(items, "broadband");
  const schoolsItem = findItemByKey(items, "nearbySchools"); // Find the checklist item
  // TODO: Find mobile coverage item when added

  const stationScoreValue = calculateStationScoreValue(nearestStationsItem);
  const broadbandScoreValue = calculateBroadbandScoreValue(broadbandItem);
  // Use the preprocessed school score
  const schoolsScoreValue = preprocessedData.nearbySchoolsScoreValue; // Get from preprocessedData

  const { combinedScoreValue, scoreLabel, warningMessage } = calculateCombinedConnectivityScore(
    stationScoreValue,
    broadbandScoreValue,
    schoolsScoreValue,
    nearestStationsItem,
    broadbandItem,
    schoolsItem
  );

  // Collect contributing items
  const contributingItems = [nearestStationsItem, broadbandItem, schoolsItem].filter(
    Boolean
  ) as PropertyDataListItem[];
  // Add mobile item when implemented

  return {
    score: { scoreValue: combinedScoreValue, maxScore: MAX_SCORE, scoreLabel },
    contributingItems,
    warningMessage,
  };
};

export default calculateConnectivityScore;
