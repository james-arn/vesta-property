import { FLOOD_RISK_LABELS } from "@/constants/floodRiskConstants";
import {
  AIRPORT_NOISE_CATEGORY_MULTIPLIERS,
  CRIME_RATINGS,
  CRIME_RATING_MULTIPLIERS,
  CRIME_SCORE_THRESHOLDS,
  FLOOD_RISK_LEVEL_MULTIPLIERS,
  MAX_SCORE,
} from "@/constants/scoreConstants";
import { CrimeRating } from "@/hooks/useCrimeScore"; // Import CrimeRating type
import {
  CoastalErosion,
  CoastalErosionEstimatedDistanceLost,
  CoastalErosionEstimatedDistanceLostTerm,
  CoastalErosionPlan,
  FloodRisk,
} from "@/types/premiumStreetData";
import { DataStatus, ProcessedConservationAreaData, PropertyDataListItem } from "@/types/property";
import { parseNumberFromString } from "@/utils/parsingHelpers";
import React from "react"; // Import React for ReactNode checks

export interface FactorProcessingResult {
  scoreContribution: number; // Score before weighting (0-MAX_SCORE)
  maxPossibleScore: number; // Max score achievable for this factor (usually MAX_SCORE if data present, 0 otherwise)
  warning?: string;
  riskLabel?: string | null; // Added for qualitative risk level
}

// --- START: Coastal Erosion Specific Definitions ---
export type CoastalRiskRating = "High Risk" | "Medium Risk" | "Low Risk" | "No Risk" | "Unknown";

export const COASTAL_EROSION_RISK_RATINGS: Record<string, CoastalRiskRating> = {
  HIGH: "High Risk",
  MEDIUM: "Medium Risk",
  LOW: "Low Risk",
  NONE: "No Risk",
  UNKNOWN: "Unknown",
};

// Defines the severity order. Higher number means higher risk.
const COASTAL_EROSION_RISK_HIERARCHY: Record<CoastalRiskRating, number> = {
  "High Risk": 4,
  "Medium Risk": 3,
  "Low Risk": 2,
  "No Risk": 1,
  Unknown: 0,
};

export const COASTAL_EROSION_RISK_MULTIPLIERS: Record<CoastalRiskRating, number> = {
  "High Risk": 1.0,
  "Medium Risk": 0.6,
  "Low Risk": 0.3,
  "No Risk": 0.0,
  Unknown: 0.0,
};
// --- END: Coastal Erosion Specific Definitions ---

export const calculateCrimeRisk = (
  item: PropertyDataListItem | undefined
): FactorProcessingResult => {
  const key = "crimeScore";
  if (!item || item.value === undefined || item.value === null || item.value === "N/A") {
    return { scoreContribution: 0, maxPossibleScore: 0, warning: "Crime score data missing." };
  }

  const value = item.value;
  let scoreContribution = 0;
  let rating: CrimeRating | null = null;
  let numericalScore: number | null = null;

  if (typeof value === "object" && value !== null && !React.isValidElement(value)) {
    if ("crimeRating" in value && typeof value.crimeRating === "string") {
      const potentialRating = value.crimeRating.trim();
      if (
        potentialRating === CRIME_RATINGS.HIGH ||
        potentialRating === CRIME_RATINGS.MODERATE ||
        potentialRating === CRIME_RATINGS.LOW
      ) {
        rating = potentialRating as CrimeRating;
      }
    }
    if (!rating && "crimeScore" in value) {
      if (typeof value.crimeScore === "string" || typeof value.crimeScore === "number") {
        numericalScore = parseNumberFromString(value.crimeScore);
      }
    }
  } else if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (
      trimmedValue === CRIME_RATINGS.HIGH ||
      trimmedValue === CRIME_RATINGS.MODERATE ||
      trimmedValue === CRIME_RATINGS.LOW
    ) {
      rating = trimmedValue as CrimeRating;
    } else {
      numericalScore = parseNumberFromString(value);
    }
  } else if (typeof value === "number") {
    numericalScore = value;
  }

  if (rating) {
    const multiplier = CRIME_RATING_MULTIPLIERS[rating] ?? 0;
    scoreContribution = MAX_SCORE * multiplier;
  } else if (numericalScore !== null) {
    if (numericalScore >= CRIME_SCORE_THRESHOLDS.high) {
      scoreContribution = MAX_SCORE * CRIME_RATING_MULTIPLIERS[CRIME_RATINGS.HIGH];
    } else if (numericalScore >= CRIME_SCORE_THRESHOLDS.medium) {
      scoreContribution = MAX_SCORE * CRIME_RATING_MULTIPLIERS[CRIME_RATINGS.MODERATE];
    } else {
      scoreContribution = MAX_SCORE * CRIME_RATING_MULTIPLIERS[CRIME_RATINGS.LOW];
    }
  } else {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Invalid or unrecognized crime score format.",
    };
  }
  return { scoreContribution, maxPossibleScore: MAX_SCORE };
};

export const calculateFloodRisk = (
  listingFloodScore: FactorProcessingResult | null | undefined,
  premiumFloodScore: FactorProcessingResult | null | undefined
): FactorProcessingResult => {
  const warnings: string[] = [];
  if (listingFloodScore?.warning) {
    warnings.push(listingFloodScore.warning);
  }
  if (premiumFloodScore?.warning) {
    warnings.push(premiumFloodScore.warning);
  }

  const totalScoreContribution =
    (listingFloodScore?.scoreContribution ?? 0) + (premiumFloodScore?.scoreContribution ?? 0);
  const totalMaxPossibleScore =
    (listingFloodScore?.maxPossibleScore ?? 0) + (premiumFloodScore?.maxPossibleScore ?? 0);

  // For the combined score, a specific riskLabel is less direct.
  // The individual labels are on listingFloodScore.riskLabel (usually null) and premiumFloodScore.riskLabel.
  // The overall environmental score will reflect the numeric impact.
  // We could concatenate labels or prioritize, but for now, keep it simple for the *combined* numeric result.
  // If a specific label is needed for the *overall* flood risk factor in the environmental score summary,
  // that logic would likely reside in how this combined result is presented, not here.

  return {
    scoreContribution: totalScoreContribution,
    maxPossibleScore: totalMaxPossibleScore,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
    riskLabel: premiumFloodScore?.riskLabel || null, // Prioritize premium label if available for the combined factor
  };
};

export const FLOOD_FACTORS_MAX_SCORE = {
  last5Years: 50,
  defences: 20,
  sources: 15,
  assessment: 15,
} as const;

export const calculateListingFloodScore = (
  floodDefences: boolean | null,
  floodSources: string[] | null,
  floodedInLastFiveYears: boolean | null,
  hasDetailedAssessmentDataForWarnings: boolean
): FactorProcessingResult => {
  const internalWarnings: string[] = [];

  const last5YearsResult = (() => {
    const score = floodedInLastFiveYears === true ? FLOOD_FACTORS_MAX_SCORE.last5Years : 0;
    if (floodedInLastFiveYears === null && !hasDetailedAssessmentDataForWarnings) {
      internalWarnings.push("Flooded in last 5 years: Status unknown/missing.");
    }
    return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.last5Years };
  })();

  const defencesResult = (() => {
    const score = floodDefences === false ? FLOOD_FACTORS_MAX_SCORE.defences : 0;
    if (floodDefences === null && !hasDetailedAssessmentDataForWarnings) {
      internalWarnings.push("Flood defences: Status unknown/missing.");
    }
    return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.defences };
  })();

  const sourcesResult = (() => {
    let hasSources = false;
    if (Array.isArray(floodSources) && floodSources.length > 0) {
      hasSources = floodSources.some(
        (source) => typeof source === "string" && source.trim() !== ""
      );
    }
    const score = hasSources ? FLOOD_FACTORS_MAX_SCORE.sources : 0;
    if (floodSources === null && !hasDetailedAssessmentDataForWarnings) {
      internalWarnings.push("Flood sources: Data unknown/missing.");
    }
    return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.sources };
  })();

  const totalScoreContribution =
    last5YearsResult.score + defencesResult.score + sourcesResult.score;
  const totalMaxPossibleScore =
    last5YearsResult.maxScore + defencesResult.maxScore + sourcesResult.maxScore;

  let riskLabel: string | null = null;
  if (totalScoreContribution > 0) {
    // If any risk factors are present, determine the risk level
    if (totalScoreContribution >= totalMaxPossibleScore * 0.7) {
      riskLabel = FLOOD_RISK_LABELS.HIGH_RISK;
    } else if (totalScoreContribution >= totalMaxPossibleScore * 0.4) {
      riskLabel = FLOOD_RISK_LABELS.MEDIUM_RISK;
    } else {
      riskLabel = FLOOD_RISK_LABELS.LOW_RISK;
    }
  } else if (totalMaxPossibleScore > 0) {
    // If we have data but no risk factors
    riskLabel = FLOOD_RISK_LABELS.VERY_LOW_RISK;
  }

  return {
    scoreContribution: totalScoreContribution,
    maxPossibleScore: totalMaxPossibleScore,
    warning: internalWarnings.length > 0 ? internalWarnings.join(" ") : undefined,
    riskLabel,
  };
};

export const calculatePremiumFloodScore = (
  detailedFloodRiskAssessment: FloodRisk | null
): FactorProcessingResult => {
  const internalWarnings: string[] = [];
  let score = 0;
  let maxScoreForAssessment = 0;
  let riskLabel: string | null = null;

  if (detailedFloodRiskAssessment) {
    maxScoreForAssessment = FLOOD_FACTORS_MAX_SCORE.assessment;
    const floodRiskData = detailedFloodRiskAssessment;
    const riskLevels = [floodRiskData.rivers_and_seas?.risk, floodRiskData.surface_water?.risk]
      .map((risk) => (risk ? risk.toLowerCase() : undefined))
      .filter((risk): risk is string => !!risk);

    if (riskLevels.length > 0) {
      let highestRiskValue = -1;
      let determinedRiskLabel = "";

      riskLevels.forEach((currentRiskKey) => {
        const currentMultiplier = FLOOD_RISK_LEVEL_MULTIPLIERS[currentRiskKey] ?? -1;
        if (currentMultiplier > highestRiskValue) {
          highestRiskValue = currentMultiplier;
          if (currentRiskKey === "very high" || currentRiskKey === "high") {
            determinedRiskLabel = FLOOD_RISK_LABELS.HIGH_RISK;
          } else if (currentRiskKey === "medium") {
            determinedRiskLabel = FLOOD_RISK_LABELS.MEDIUM_RISK;
          } else if (currentRiskKey === "low") {
            determinedRiskLabel = FLOOD_RISK_LABELS.LOW_RISK;
          } else if (currentRiskKey === "very low") {
            determinedRiskLabel = FLOOD_RISK_LABELS.VERY_LOW_RISK;
          } else {
            determinedRiskLabel = FLOOD_RISK_LABELS.RISK_LEVEL_ASSESSED;
          }
        }
        if (currentMultiplier === -1) {
          internalWarnings.push(`Unrecognized flood risk level: \'${currentRiskKey}\'.`);
        }
      });

      riskLabel = determinedRiskLabel || FLOOD_RISK_LABELS.RISK_LEVEL_ASSESSED;

      if (highestRiskValue >= 0) {
        score = FLOOD_FACTORS_MAX_SCORE.assessment * highestRiskValue;
      } else {
        if (!internalWarnings.some((w) => w.startsWith("Unrecognized flood risk level:"))) {
          internalWarnings.push("Could not determine flood risk score from assessment levels.");
        }
        if (riskLabel === FLOOD_RISK_LABELS.RISK_LEVEL_ASSESSED && riskLevels.length > 0) {
          riskLabel = FLOOD_RISK_LABELS.ASSESSMENT_AVAILABLE_UNQUANTIFIED;
        }
      }
    } else {
      internalWarnings.push("Flood risk assessment present but risk levels missing.");
      riskLabel = FLOOD_RISK_LABELS.ASSESSMENT_AVAILABLE_NO_SPECIFIC_LEVELS;
    }
  } else {
    riskLabel = null;
  }

  return {
    scoreContribution: score,
    maxPossibleScore: maxScoreForAssessment,
    warning: internalWarnings.length > 0 ? internalWarnings.join(" ") : undefined,
    riskLabel,
  };
};

// --- START: New Coastal Erosion Helper Functions ---

const getRiskRatingFromString = (ratingStr: string | null | undefined): CoastalRiskRating => {
  if (!ratingStr) return COASTAL_EROSION_RISK_RATINGS.UNKNOWN;
  const lowerRating = ratingStr.toLowerCase();
  if (lowerRating.includes("high")) return COASTAL_EROSION_RISK_RATINGS.HIGH;
  if (lowerRating.includes("medium")) return COASTAL_EROSION_RISK_RATINGS.MEDIUM;
  if (lowerRating.includes("low")) return COASTAL_EROSION_RISK_RATINGS.LOW;
  if (lowerRating.includes("no risk")) return COASTAL_EROSION_RISK_RATINGS.NONE;
  return COASTAL_EROSION_RISK_RATINGS.UNKNOWN;
};

const extractRiskRatingsFromTerm = (
  term: CoastalErosionEstimatedDistanceLostTerm | null
): CoastalRiskRating => {
  return getRiskRatingFromString(term?.risk?.risk_rating);
};

const extractRiskRatingsFromDistanceLost = (
  distanceLost: CoastalErosionEstimatedDistanceLost | null
): CoastalRiskRating[] => {
  if (!distanceLost) return [COASTAL_EROSION_RISK_RATINGS.UNKNOWN];
  return [
    extractRiskRatingsFromTerm(distanceLost.short_term),
    extractRiskRatingsFromTerm(distanceLost.medium_term),
    extractRiskRatingsFromTerm(distanceLost.long_term),
  ];
};

const extractRiskRatingsFromPlan = (plan: CoastalErosionPlan): CoastalRiskRating[] => {
  let ratings: CoastalRiskRating[] = [];
  if (plan.shore_management_plan?.estimated_distance_lost) {
    ratings = ratings.concat(
      extractRiskRatingsFromDistanceLost(plan.shore_management_plan.estimated_distance_lost)
    );
  }
  if (plan.no_active_intervention?.estimated_distance_lost) {
    ratings = ratings.concat(
      extractRiskRatingsFromDistanceLost(plan.no_active_intervention.estimated_distance_lost)
    );
  }
  return ratings.length > 0 ? ratings : [COASTAL_EROSION_RISK_RATINGS.UNKNOWN];
};

export const determineOverallCoastalRisk = (
  coastalErosianDetails: CoastalErosion | null | undefined
): CoastalRiskRating => {
  if (!coastalErosianDetails) {
    return COASTAL_EROSION_RISK_RATINGS.UNKNOWN;
  }

  if (coastalErosianDetails?.can_have_erosion_plan === false) {
    return COASTAL_EROSION_RISK_RATINGS.NONE;
  }

  if (!coastalErosianDetails?.plans || coastalErosianDetails?.plans.length === 0) {
    return coastalErosianDetails?.can_have_erosion_plan === true
      ? COASTAL_EROSION_RISK_RATINGS.LOW
      : COASTAL_EROSION_RISK_RATINGS.UNKNOWN;
  }

  const allRiskRatings = coastalErosianDetails.plans.flatMap(extractRiskRatingsFromPlan);

  const specificRiskRatings = allRiskRatings.filter(
    (r) => r !== COASTAL_EROSION_RISK_RATINGS.UNKNOWN
  );

  const ratingsToConsider = specificRiskRatings.length > 0 ? specificRiskRatings : allRiskRatings;

  if (ratingsToConsider.length === 0) {
    return coastalErosianDetails.can_have_erosion_plan === null
      ? COASTAL_EROSION_RISK_RATINGS.UNKNOWN
      : COASTAL_EROSION_RISK_RATINGS.NONE;
  }

  let highestRisk = COASTAL_EROSION_RISK_RATINGS.NONE;

  if (ratingsToConsider.every((r) => r === COASTAL_EROSION_RISK_RATINGS.UNKNOWN)) {
    highestRisk = COASTAL_EROSION_RISK_RATINGS.UNKNOWN;
  } else {
    for (const rating of ratingsToConsider) {
      if (rating === COASTAL_EROSION_RISK_RATINGS.UNKNOWN) continue;
      if (COASTAL_EROSION_RISK_HIERARCHY[rating] > COASTAL_EROSION_RISK_HIERARCHY[highestRisk]) {
        highestRisk = rating;
      }
    }
  }
  return highestRisk;
};

// --- END: New Coastal Erosion Helper Functions ---

export const calculateCoastalErosionRisk = (
  coastalData: PropertyDataListItem | null | undefined
): FactorProcessingResult => {
  const coastalErosianDetails = coastalData?.coastalErosionDetails?.detailsForAccordion;
  if (!coastalErosianDetails) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Coastal erosion API data missing.",
    };
  }

  const overallRiskRating = determineOverallCoastalRisk(coastalErosianDetails);

  let scoreContribution = 0;
  let maxPossibleScore = 0;
  let warning: string | undefined = undefined;

  if (
    coastalErosianDetails?.can_have_erosion_plan !== null ||
    (coastalErosianDetails?.plans && coastalErosianDetails?.plans.length > 0)
  ) {
    maxPossibleScore = MAX_SCORE;
  } else {
    maxPossibleScore = 0;
  }

  if (overallRiskRating === COASTAL_EROSION_RISK_RATINGS.UNKNOWN) {
    scoreContribution = 0;
    if (maxPossibleScore === MAX_SCORE) {
      warning = "Coastal erosion risk status could not be determined from available plan data.";
    } else {
      warning = "Coastal erosion risk status unknown due to missing data.";
    }
  } else {
    scoreContribution = MAX_SCORE * (COASTAL_EROSION_RISK_MULTIPLIERS[overallRiskRating] ?? 0);
    maxPossibleScore = MAX_SCORE;
  }

  if (
    overallRiskRating === COASTAL_EROSION_RISK_RATINGS.NONE &&
    coastalErosianDetails?.can_have_erosion_plan === true &&
    (!coastalErosianDetails?.plans || coastalErosianDetails?.plans.length === 0)
  ) {
    warning =
      "Property in potential risk area, but no specific erosion plans found; assessed as 'No Risk'.";
  }
  if (
    overallRiskRating === COASTAL_EROSION_RISK_RATINGS.LOW &&
    coastalErosianDetails?.can_have_erosion_plan === true &&
    (!coastalErosianDetails?.plans || coastalErosianDetails?.plans.length === 0)
  ) {
    warning =
      "Property in potential risk area, defaulted to 'Low Risk' due to no specific erosion plans.";
  }

  return { scoreContribution, maxPossibleScore, warning };
};

export const calculateAirportNoiseRisk = (
  item: PropertyDataListItem | undefined
): FactorProcessingResult => {
  if (!item) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Airport noise data item missing.",
    };
  }

  const { value } = item;
  if (value === undefined || value === null || value === "N/A") {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Airport noise data missing or N/A.",
    };
  }

  const determineCategoryAndWarning = (): { category?: string; warning?: string } => {
    if (
      typeof value === "object" &&
      value !== null &&
      !React.isValidElement(value) &&
      "category" in value &&
      typeof value.category === "string"
    ) {
      return { category: value.category };
    }
    if (typeof value === "string") {
      const potentialCategory = value.trim();
      if (Object.keys(AIRPORT_NOISE_CATEGORY_MULTIPLIERS).includes(potentialCategory)) {
        return { category: potentialCategory };
      }
      return { warning: `Unrecognized airport noise category string: '${potentialCategory}'.` };
    }
    return { warning: "Unexpected format for airport noise data." };
  };

  const { category, warning: initialWarning } = determineCategoryAndWarning();

  if (initialWarning) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: initialWarning,
    };
  }

  if (category && category in AIRPORT_NOISE_CATEGORY_MULTIPLIERS) {
    const multiplier = AIRPORT_NOISE_CATEGORY_MULTIPLIERS[category];
    const scoreContribution = MAX_SCORE * multiplier;
    const maxPossibleScore = MAX_SCORE;
    return { scoreContribution, maxPossibleScore };
  }

  return {
    scoreContribution: 0,
    maxPossibleScore: 0,
    warning: "Could not determine airport noise category from provided data.",
  };
};

export const calculateConservationAreaRisk = (
  details: ProcessedConservationAreaData | null
): FactorProcessingResult => {
  if (!details) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Conservation area details object missing.",
    };
  }

  const { isInArea, status } = details;

  if (status === DataStatus.IS_LOADING) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Conservation area data availability unknown.",
    };
  }

  if (isInArea === false) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "",
    };
  }

  if (isInArea) {
    return {
      scoreContribution: MAX_SCORE,
      maxPossibleScore: MAX_SCORE,
    };
  } else {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Conservation area status unclear despite data being available",
    };
  }
};
