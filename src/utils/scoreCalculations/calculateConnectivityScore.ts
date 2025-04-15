import { FOUND_STATIONS_SCORE, MAX_SCORE, NO_STATIONS_SCORE } from "@/constants/scoreConstants";
import { CategoryScoreData, DataStatus, PropertyDataListItem } from "@/types/property";
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
    return NO_STATIONS_SCORE; // Assign low score if item is missing
  }

  switch (nearestStationsItem.status) {
    case DataStatus.FOUND_POSITIVE:
      return FOUND_STATIONS_SCORE;
    case DataStatus.ASK_AGENT:
      return NO_STATIONS_SCORE;
    // Handle other statuses like NOT_APPLICABLE or IS_LOADING if needed
    // Treat them as neutral/unknown for now
    case DataStatus.IS_LOADING:
    case DataStatus.NOT_APPLICABLE:
    default:
      return (FOUND_STATIONS_SCORE + NO_STATIONS_SCORE) / 2; // Mid-point
  }
};

const calculateCombinedConnectivityScore = (
  stationScoreValue: number,
  nearestStationsItem: PropertyDataListItem | undefined
): { combinedScoreValue: number; scoreLabel: string } => {
  const combinedScoreValue = stationScoreValue; // Only station score for now

  const baseScoreLabel =
    combinedScoreValue >= FOUND_STATIONS_SCORE * 0.9
      ? "Good Connectivity"
      : combinedScoreValue <= NO_STATIONS_SCORE * 1.1
        ? "Poor Connectivity"
        : "Average Connectivity";

  const hasLimitedStationData =
    !nearestStationsItem || nearestStationsItem.status === DataStatus.ASK_AGENT;

  const scoreLabel = hasLimitedStationData
    ? `${baseScoreLabel} (Station data limited)`
    : baseScoreLabel;

  return { combinedScoreValue, scoreLabel };
};

// --- Overall Connectivity Score --- //
const calculateConnectivityScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  const nearestStationsItem = findItemByKey(items, "nearestStations");

  const stationScoreValue = calculateStationScoreValue(nearestStationsItem);
  // TODO: Calculate scores for broadband, mobile etc.

  const { combinedScoreValue, scoreLabel } = calculateCombinedConnectivityScore(
    stationScoreValue,
    nearestStationsItem
  );

  return {
    score: { scoreValue: combinedScoreValue, maxScore: MAX_SCORE, scoreLabel },
    contributingItems: items, // Return all items passed in as they all contribute currently
  };
};

export default calculateConnectivityScore;
