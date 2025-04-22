import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { FOUND_STATIONS_SCORE, MAX_SCORE, NO_STATIONS_SCORE } from "@/constants/scoreConstants";
import {
  CategoryScoreData,
  DataStatus,
  PreprocessedData,
  PropertyDataListItem,
} from "@/types/property";
import { findItemByKey } from "@/utils/parsingHelpers";

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

// --- Combined Score --- //
const calculateCombinedConnectivityScore = (
  stationScoreValue: number,
  broadbandScoreValue: number,
  schoolsScoreValue: number,
  nearestStationsItem: PropertyDataListItem | undefined,
  broadbandItem: PropertyDataListItem | undefined,
  schoolsItem: PropertyDataListItem | undefined,
  preprocessedData: PreprocessedData
): { combinedScoreValue: number; scoreLabel: string; warningMessages?: string[] } => {
  // --- Weighting --- (Adjust as needed)
  const stationWeight = 0.5;
  const broadbandWeight = 0.2;
  const schoolsWeight = 0.3;
  // const mobileCoverageWeight = 0.0; // Add when data available

  const weightedScore =
    stationScoreValue * stationWeight +
    broadbandScoreValue * broadbandWeight +
    schoolsScoreValue * schoolsWeight;
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

  let scoreLabel = "Average";

  if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.EXCELLENT) {
    scoreLabel = "Excellent";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.VERY_GOOD) {
    scoreLabel = "Very Good";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.GOOD) {
    scoreLabel = "Well Connected";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.ABOVE_AVERAGE) {
    scoreLabel = "Above Average";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.AVERAGE) {
    scoreLabel = "Average";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.BELOW_AVERAGE) {
    scoreLabel = "Below Average";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.POOR) {
    scoreLabel = "Poorly Connected";
  } else if (combinedScoreValue >= CONNECTIVITY_SCORE_THRESHOLDS.VERY_POOR) {
    scoreLabel = "Very Poor";
  } else {
    scoreLabel = "Extremely Poor";
  }

  // --- Generate Warning --- //
  const warningMessages: string[] = [];
  if (
    !nearestStationsItem ||
    [DataStatus.ASK_AGENT, DataStatus.FOUND_NEGATIVE, DataStatus.IS_LOADING].includes(
      nearestStationsItem.status
    )
  ) {
    warningMessages.push("Station data limited/unavailable.");
  }
  if (preprocessedData.broadbandStatus !== DataStatus.FOUND_POSITIVE) {
    warningMessages.push("Broadband speed unknown/unavailable.");
  }
  if (
    !schoolsItem ||
    [DataStatus.ASK_AGENT, DataStatus.FOUND_NEGATIVE, DataStatus.IS_LOADING].includes(
      schoolsItem.status
    )
  ) {
    warningMessages.push("School data limited/unavailable.");
  }

  return { combinedScoreValue, scoreLabel, warningMessages };
};

// --- Overall Connectivity Score --- //
const calculateConnectivityScore = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData
): CategoryScoreData | undefined => {
  const nearestStationsItem = findItemByKey(items, CHECKLIST_KEYS.NEAREST_STATIONS);
  const broadbandItem = findItemByKey(items, CHECKLIST_KEYS.BROADBAND);
  const schoolsItem = findItemByKey(items, CHECKLIST_KEYS.NEARBY_SCHOOLS);

  const stationScoreValue = calculateStationScoreValue(nearestStationsItem);
  const broadbandScoreValue = preprocessedData.broadbandScoreValue ?? 50;
  const rawSchoolsScoreValue = preprocessedData.nearbySchoolsScoreValue;
  // TOO: fill with premium data.

  // Ensure schoolsScoreValue is valid for calculation, default if necessary
  const effectiveSchoolsScore = rawSchoolsScoreValue ?? 50; // Use the default if null

  const { combinedScoreValue, scoreLabel, warningMessages } = calculateCombinedConnectivityScore(
    stationScoreValue,
    broadbandScoreValue,
    effectiveSchoolsScore,
    nearestStationsItem,
    broadbandItem,
    schoolsItem,
    preprocessedData
  );

  const contributingItems = [nearestStationsItem, broadbandItem, schoolsItem].filter(
    Boolean
  ) as PropertyDataListItem[];

  return {
    score: { scoreValue: combinedScoreValue, maxScore: MAX_SCORE, scoreLabel },
    contributingItems,
    warningMessages: warningMessages ?? [],
  };
};

export default calculateConnectivityScore;
