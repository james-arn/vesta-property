import {
  CATEGORY_ITEM_MAP,
  DashboardScoreCategory,
} from "@/constants/dashboardScoreCategoryConsts";
import { ENVIRONMENT_RISK_FACTOR_WEIGHTS, MAX_SCORE } from "@/constants/scoreConstants";
import { CategoryScoreData, PreprocessedData, PropertyDataListItem } from "@/types/property";
import { findItemByKey } from "@/utils/parsingHelpers";
import {
  calculateAirportNoiseRisk,
  calculateCoastalErosionRisk,
  calculateConservationAreaRisk,
  calculateCrimeRisk,
  calculateFloodRisk,
  calculateMiningImpactRisk,
} from "./helpers/environmentalProcessingHelpers";

// Define risk score thresholds and labels (higher score = higher risk)
const RISK_THRESHOLDS = [
  { threshold: 65, label: "High Risk" },
  { threshold: 50, label: "Medium-High Risk" },
  { threshold: 35, label: "Medium Risk" },
  { threshold: 20, label: "Low-Medium Risk" },
  { threshold: 0, label: "Low Risk" },
];

const getEnvironmentalRiskLabel = (riskScore: number): string => {
  const matchedThreshold = RISK_THRESHOLDS.find(({ threshold }) => riskScore >= threshold);
  return matchedThreshold?.label || "Low Risk"; // Default to low risk
};

export const calculateEnvironmentalRiskScore = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData
): CategoryScoreData => {
  const contributingFactorKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.ENVIRONMENTAL_RISK] || [];
  const contributingItems = items.filter((item) => contributingFactorKeys.includes(item.key));

  // Find specific items using helper
  const crimeItem = findItemByKey(items, "crimeScore");
  const floodDefencesItem = findItemByKey(items, "floodDefences");
  const floodSourcesItem = findItemByKey(items, "floodSources");
  const floodedLast5YearsItem = findItemByKey(items, "floodedInLastFiveYears");
  const detailedFloodRiskAssessmentItem = findItemByKey(items, "detailedFloodRiskAssessment");
  const coastalErosionItem = findItemByKey(items, "coastalErosion");
  const airportNoiseItem = findItemByKey(items, "airportNoiseAssessment");
  const conservationAreaItem = findItemByKey(items, "conservationArea");
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

  // Calculate total weighted score and max possible weighted score
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

  // Normalize the final score (0-100)
  // The score represents the percentage of the maximum *possible* risk identified based on available data.
  const normalizedScore =
    maxPossibleWeightedScore > 0 ? (totalWeightedScore / maxPossibleWeightedScore) * 100 : 0; // If no data available, score is 0

  const finalScoreValue = Math.max(0, Math.min(100, Math.round(normalizedScore))); // Cap score between 0-100
  const scoreLabel = getEnvironmentalRiskLabel(finalScoreValue);

  // Combine warnings into a single message
  const finalWarningMessage = allWarnings.length > 0 ? allWarnings.join(" ") : undefined;

  return {
    score: { scoreValue: finalScoreValue, maxScore: MAX_SCORE, scoreLabel },
    contributingItems,
    warningMessage: finalWarningMessage,
  };
};
