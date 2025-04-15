import { CategoryScoreData, PropertyDataListItem } from "@/types/property";
import { findItemByKey } from "@/utils/parsingHelpers"; // Import findItemByKey

export const calculateEnvironmentalRiskScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  console.warn("Environmental Risk score calculation needs implementation beyond placeholders.");
  // TODO: Implement logic summing risk points from flood, crime, noise, etc.
  const crimeItem = findItemByKey(items, "crimeScore");
  // ... get other relevant items ...
  let totalRiskPoints = 0;
  // Add points based on crime score value, flood status, etc.
  // Example: if crime score is high, add points.

  const finalScoreValue = Math.max(0, Math.min(100, totalRiskPoints)); // Higher score = higher risk

  const getEnvironmentalRiskLabel = (riskScore: number): string => {
    if (riskScore >= 65) return "High Risk";
    if (riskScore >= 50) return "Medium-High Risk";
    if (riskScore >= 35) return "Medium Risk";
    if (riskScore >= 20) return "Low-Medium Risk";
    return "Low Risk";
  };
  const scoreLabel = getEnvironmentalRiskLabel(finalScoreValue);

  return {
    score: { scoreValue: Math.round(finalScoreValue), maxScore: 100, scoreLabel },
    contributingItems: items, // TODO: Filter this
  };
};
