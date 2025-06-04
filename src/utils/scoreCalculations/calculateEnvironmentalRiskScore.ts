import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import {
  CALCULATED_STATUS,
  CATEGORY_ITEM_MAP,
  DashboardScoreCategory,
} from "@/constants/dashboardScoreCategoryConsts";
import { ENVIRONMENT_RISK_FACTOR_WEIGHTS, MAX_SCORE } from "@/constants/scoreConstants";
import {
  CategoryScoreData,
  PreprocessedData,
  PropertyDataListItem,
  ScoreCalculationStatus,
  ScoreQuality,
} from "@/types/property";
import { findItemByKey } from "@/utils/parsingHelpers";
import {
  calculateAirportNoiseRisk,
  calculateCoastalErosionRisk,
  calculateConservationAreaRisk,
  calculateCrimeRisk,
  calculateFloodRisk,
} from "./helpers/environmentalProcessingHelpers";

const RISK_THRESHOLDS = [
  { threshold: 80, label: "Low Risk" }, // Corresponds to inverted score >= 80
  { threshold: 65, label: "Low-Medium Risk" }, // Corresponds to inverted score >= 65
  { threshold: 50, label: "Medium Risk" }, // Corresponds to inverted score >= 50
  { threshold: 35, label: "Medium-High Risk" }, // Corresponds to inverted score >= 35
  { threshold: 0, label: "High Risk" }, // Corresponds to inverted score >= 0
];

const getEnvironmentalRiskLabel = (invertedScore: number): string => {
  const matchedThreshold = RISK_THRESHOLDS.find(({ threshold }) => invertedScore >= threshold);
  return matchedThreshold?.label || "Low Risk"; // Default to low risk
};

export const calculateEnvironmentalRiskScore = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData
): CategoryScoreData => {
  const contributingFactorKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.ENVIRONMENT_RISK] || [];
  // Filter items first
  const filteredItems = items.filter((item) =>
    (contributingFactorKeys as string[]).includes(item.key)
  );

  // Then sort the filtered items based on the order in contributingFactorKeys
  const contributingItems = filteredItems.sort((a, b) => {
    const indexA = (contributingFactorKeys as string[]).indexOf(a.key);
    const indexB = (contributingFactorKeys as string[]).indexOf(b.key);
    // Handle cases where a key might not be in contributingFactorKeys (should not happen if logic is correct)
    if (indexA === -1 && indexB === -1) return 0; // both not found, treat as equal
    if (indexA === -1) return 1; // a not found, sort a after b
    if (indexB === -1) return -1; // b not found, sort a before b
    return indexA - indexB;
  });

  const crimeItem = findItemByKey(items, CHECKLIST_KEYS.CRIME_SCORE);
  const coastalErosionItem = findItemByKey(items, CHECKLIST_KEYS.COASTAL_EROSION);
  const airportNoiseItem = findItemByKey(items, CHECKLIST_KEYS.AIRPORT_NOISE_ASSESSMENT);
  const conservationAreaDetails = preprocessedData.processedConservationArea;

  const listingFloodScore =
    preprocessedData.completeFloodRiskAssessment?.listingFloodRiskAssessment?.score;
  const premiumFloodScore =
    preprocessedData.completeFloodRiskAssessment?.premiumFloodRiskAssessment?.score;

  const results = [
    { key: "crimeScore", result: calculateCrimeRisk(crimeItem) },
    {
      key: "floodRisk",
      result: calculateFloodRisk(listingFloodScore, premiumFloodScore),
    },
    { key: "coastalErosion", result: calculateCoastalErosionRisk(coastalErosionItem) },
    { key: "airportNoiseAssessment", result: calculateAirportNoiseRisk(airportNoiseItem) },
    {
      key: "conservationArea",
      result: calculateConservationAreaRisk(conservationAreaDetails),
    },
  ];

  const allWarnings = results
    .map(({ result }) => result.warning)
    .filter((warning): warning is string => !!warning);

  // Calculate weighted scores and max possible scores based on available data
  const { totalWeightedRiskPenalty, maxPossibleWeightedRiskPenalty } = results.reduce(
    (acc, { key, result }) => {
      const weight = ENVIRONMENT_RISK_FACTOR_WEIGHTS[key] || 0;
      let currentMaxWeightedPenalty = 0;

      if (result.maxPossibleScore > 0) {
        currentMaxWeightedPenalty = MAX_SCORE * weight;
        acc.totalWeightedRiskPenalty +=
          (result.scoreContribution / result.maxPossibleScore) * weight;
        acc.maxPossibleWeightedRiskPenalty += weight;
      }
      return acc;
    },
    { totalWeightedRiskPenalty: 0, maxPossibleWeightedRiskPenalty: 0 }
  );

  const calculationStatus: ScoreCalculationStatus =
    maxPossibleWeightedRiskPenalty > 0
      ? CALCULATED_STATUS.CALCULATED
      : CALCULATED_STATUS.UNCALCULATED_MISSING_DATA; // Corrected constant

  let finalScoreForDisplay: import("@/types/property").DashboardScore | null = null;
  let environmentalRiskLabel: string;

  if (calculationStatus === CALCULATED_STATUS.CALCULATED) {
    // normalizedRiskPenalty is the percentage of the maximum possible weighted risk (given available data) that is realized.
    // e.g. if maxPossibleWeightedRiskPenalty is 50, and totalWeightedRiskPenalty is 25, then normalizedRiskPenalty is 50%
    const normalizedRiskPenalty = (totalWeightedRiskPenalty / maxPossibleWeightedRiskPenalty) * 100;

    // Invert the score: Higher safety (lower risk) gets a higher score for display.
    const invertedScoreValue = MAX_SCORE - normalizedRiskPenalty;
    const finalScoreValue = Math.max(0, Math.min(100, Math.round(invertedScoreValue)));

    environmentalRiskLabel = getEnvironmentalRiskLabel(finalScoreValue);

    finalScoreForDisplay = {
      scoreValue: finalScoreValue,
      maxScore: MAX_SCORE,
      scoreLabel: environmentalRiskLabel,
    };
  } else {
    environmentalRiskLabel = "Data Missing";
    allWarnings.push("Could not calculate Environmental Risk score due to insufficient data.");
  }

  // Determine ScoreQuality based on the inverted score (where higher is better)
  const determinedScoreQuality = (() => {
    if (calculationStatus !== CALCULATED_STATUS.CALCULATED) return ScoreQuality.UNKNOWN;
    // Use finalScoreForDisplay.scoreValue which is the inverted score (0-100, higher is better)
    const scoreForQuality = finalScoreForDisplay?.scoreValue ?? 0;
    if (scoreForQuality >= 80) return ScoreQuality.GOOD;
    if (scoreForQuality >= 50) return ScoreQuality.AVERAGE;
    return ScoreQuality.POOR;
  })();

  // If score quality is unknown due to missing data, the label might need adjustment
  if (
    determinedScoreQuality === ScoreQuality.UNKNOWN &&
    calculationStatus === CALCULATED_STATUS.UNCALCULATED_MISSING_DATA
  ) {
    environmentalRiskLabel = "Partial Data";
    if (finalScoreForDisplay) {
      finalScoreForDisplay.scoreLabel = environmentalRiskLabel;
    }
  }

  return {
    score: finalScoreForDisplay,
    calculationStatus,
    contributingItems,
    warningMessages: allWarnings.length > 0 ? allWarnings : undefined,
  };
};
