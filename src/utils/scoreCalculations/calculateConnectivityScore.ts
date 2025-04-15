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

// --- Broadband Scoring (Placeholder) --- //
// TODO: Implement actual broadband scoring based on speed
const calculateBroadbandScoreValue = (broadbandItem: PropertyDataListItem | undefined): number => {
  if (!broadbandItem || broadbandItem.status !== DataStatus.FOUND_POSITIVE) {
    return 50; // Default/neutral score if no data or negative
  }
  // Basic placeholder: Assume positive finding is good for now
  return 80;
};

// --- Combined Score --- //
const calculateCombinedConnectivityScore = (
  stationScoreValue: number,
  broadbandScoreValue: number,
  nearestStationsItem: PropertyDataListItem | undefined,
  broadbandItem: PropertyDataListItem | undefined
): { combinedScoreValue: number; scoreLabel: string; warningMessage?: string } => {
  // --- Weighting --- (Adjust as needed)
  const stationWeight = 0.7;
  const broadbandWeight = 0.3;
  // const mobileCoverageWeight = 0.0; // Add when data available

  const weightedScore = stationScoreValue * stationWeight + broadbandScoreValue * broadbandWeight;
  // + (mobileScore * mobileCoverageWeight);

  // Ensure score is within 0-100
  const combinedScoreValue = Math.max(0, Math.min(MAX_SCORE, Math.round(weightedScore)));

  // --- Determine Label --- //
  let scoreLabel = "Average Connectivity";
  if (combinedScoreValue >= 75) {
    scoreLabel = "Good Connectivity";
  } else if (combinedScoreValue < 40) {
    scoreLabel = "Poor Connectivity";
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
  const warningMessage = warningParts.length > 0 ? warningParts.join(" ") : undefined;

  return { combinedScoreValue, scoreLabel, warningMessage };
};

// --- Overall Connectivity Score --- //
const calculateConnectivityScore = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData // Accept PreprocessedData (unused for now)
): CategoryScoreData | undefined => {
  const nearestStationsItem = findItemByKey(items, "nearestStations");
  const broadbandItem = findItemByKey(items, "broadband");
  // TODO: Find mobile coverage item when added
  // TODO: Find schools

  const stationScoreValue = calculateStationScoreValue(nearestStationsItem);
  const broadbandScoreValue = calculateBroadbandScoreValue(broadbandItem);

  const { combinedScoreValue, scoreLabel, warningMessage } = calculateCombinedConnectivityScore(
    stationScoreValue,
    broadbandScoreValue,
    nearestStationsItem,
    broadbandItem
  );

  // Collect contributing items
  const contributingItems = [nearestStationsItem, broadbandItem].filter(
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
