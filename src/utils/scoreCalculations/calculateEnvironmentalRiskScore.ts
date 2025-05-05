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
  const contributingItems = items.filter((item) =>
    (contributingFactorKeys as string[]).includes(item.key)
  );

  const crimeItem = findItemByKey(items, CHECKLIST_KEYS.CRIME_SCORE);
  const floodDefencesItem = findItemByKey(items, CHECKLIST_KEYS.FLOOD_DEFENCES);
  const floodSourcesItem = findItemByKey(items, CHECKLIST_KEYS.FLOOD_SOURCES);
  const floodedLast5YearsItem = findItemByKey(items, CHECKLIST_KEYS.FLOODED_IN_LAST_FIVE_YEARS);
  const detailedFloodRiskAssessmentItem = findItemByKey(
    items,
    CHECKLIST_KEYS.DETAILED_FLOOD_RISK_ASSESSMENT
  );
  const coastalErosionItem = findItemByKey(items, CHECKLIST_KEYS.COASTAL_EROSION);
  const airportNoiseItem = findItemByKey(items, CHECKLIST_KEYS.AIRPORT_NOISE_ASSESSMENT);
  const miningStatus = preprocessedData.miningImpactStatus;
  const conservationAreaDetails = preprocessedData.conservationAreaDetails;

  // Calculate raw contributions and gather warnings
  const results = [
    { key: "crimeScore", result: calculateCrimeRisk(crimeItem) },
    {
      key: "floodRisk",
      result: calculateFloodRisk(
        floodDefencesItem,
        floodSourcesItem,
        floodedLast5YearsItem,
        detailedFloodRiskAssessmentItem
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
