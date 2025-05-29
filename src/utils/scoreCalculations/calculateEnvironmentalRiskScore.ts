import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import {
  CALCULATED_STATUS,
  CATEGORY_ITEM_MAP,
  DashboardScoreCategory,
} from "@/constants/dashboardScoreCategoryConsts";
import { ENVIRONMENT_RISK_FACTOR_WEIGHTS, MAX_SCORE } from "@/constants/scoreConstants";
import {
  CategoryScoreData,
  DashboardScore,
  PreprocessedData,
  PropertyDataListItem,
  ScoreCalculationStatus,
} from "@/types/property";
import { findItemByKey } from "@/utils/parsingHelpers";
import {
  calculateAirportNoiseRisk,
  calculateCoastalErosionRisk,
  calculateConservationAreaRisk,
  calculateCrimeRisk,
  calculateFloodRisk,
  calculateMiningImpactRisk,
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
  const miningStatus = preprocessedData.miningImpactStatus;
  const conservationAreaDetails = preprocessedData.conservationAreaDetails;

  const rawFloodDefences = preprocessedData.rawFloodDefences;
  const rawFloodSources = preprocessedData.rawFloodSources;
  const rawFloodedInLastFiveYears = preprocessedData.rawFloodedInLastFiveYears;
  const detailedFloodRiskAssessmentData =
    preprocessedData.processedPremiumData?.detailedFloodRiskAssessment ?? null;

  // Calculate raw contributions and gather warnings
  const results = [
    { key: "crimeScore", result: calculateCrimeRisk(crimeItem) },
    {
      key: "floodRisk",
      result: calculateFloodRisk(
        rawFloodDefences,
        rawFloodSources,
        rawFloodedInLastFiveYears,
        detailedFloodRiskAssessmentData
      ),
    },
    { key: "coastalErosion", result: calculateCoastalErosionRisk(coastalErosionItem) },
    { key: "miningImpact", result: calculateMiningImpactRisk(miningStatus) },
    { key: "airportNoiseAssessment", result: calculateAirportNoiseRisk(airportNoiseItem) },
    { key: "conservationArea", result: calculateConservationAreaRisk(conservationAreaDetails) },
  ];

  const allWarnings = results
    .map(({ result }) => result.warning)
    .filter((warning): warning is string => !!warning);

  const { totalWeightedScore, maxPossibleWeightedScore } = results.reduce(
    (acc, { key, result }) => {
      const weight = ENVIRONMENT_RISK_FACTOR_WEIGHTS[key] ?? 0;
      // Only add to max possible score if the factor could be assessed (maxPossibleScore > 0)
      const possibleScoreIncrement = result.maxPossibleScore > 0 ? MAX_SCORE * weight : 0;

      return {
        totalWeightedScore: acc.totalWeightedScore + result.scoreContribution * weight,
        maxPossibleWeightedScore: acc.maxPossibleWeightedScore + possibleScoreIncrement,
      };
    },
    { totalWeightedScore: 0, maxPossibleWeightedScore: 0 }
  );

  const calculationStatus: ScoreCalculationStatus =
    maxPossibleWeightedScore > 0
      ? CALCULATED_STATUS.CALCULATED
      : CALCULATED_STATUS.UNCALCULATED_MISSING_DATA;

  let finalScore: DashboardScore | null = null;
  let scoreLabel = "Data Missing"; // Default label if uncalculated

  if (calculationStatus === CALCULATED_STATUS.CALCULATED) {
    const normalizedRiskScore = (totalWeightedScore / maxPossibleWeightedScore) * 100;
    // Invert the score: Higher safety (lower risk) gets a higher score.
    const invertedScoreValue = MAX_SCORE - normalizedRiskScore;
    const finalScoreValue = Math.max(0, Math.min(100, Math.round(invertedScoreValue)));

    // Use the inverted score to get the label
    scoreLabel = getEnvironmentalRiskLabel(finalScoreValue);

    finalScore = {
      scoreValue: finalScoreValue, // Return the inverted score (high = good)
      maxScore: MAX_SCORE,
      scoreLabel: scoreLabel, // Label still describes risk level
    };
    if (finalScoreValue === 0 && allWarnings.length === 0) {
      // Add warning if score is 0 but no specific factor warnings exist
      allWarnings.push(
        "Environmental Risk score is zero, potentially due to missing specific risk data."
      );
    }
  } else {
    allWarnings.push(
      "Could not calculate Environmental Risk score due to missing data for all relevant factors."
    );
  }

  return {
    score: finalScore,
    contributingItems,
    warningMessages: allWarnings,
    calculationStatus: calculationStatus,
  };
};
