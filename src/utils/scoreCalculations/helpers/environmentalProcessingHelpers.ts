import {
  CRIME_RATINGS,
  CRIME_RATING_MULTIPLIERS,
  CRIME_SCORE_THRESHOLDS,
  MAX_SCORE,
} from "@/constants/scoreConstants";
import { CrimeRating } from "@/hooks/useCrimeScore"; // Import CrimeRating type
import { PropertyDataListItem } from "@/types/property";
import { parseNumberFromString, parseYesNoUnknown } from "@/utils/parsingHelpers";
import React from "react"; // Import React for ReactNode checks

interface FactorProcessingResult {
  scoreContribution: number; // Score before weighting (0-MAX_SCORE)
  maxPossibleScore: number; // Max score achievable for this factor (usually MAX_SCORE if data present, 0 otherwise)
  warning?: string;
}

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

  // 1. Check if value is an object (potentially CrimeScoreResponse)
  if (typeof value === "object" && value !== null && !React.isValidElement(value)) {
    // Check for properties defensively
    if ("crimeRating" in value && typeof value.crimeRating === "string") {
      const potentialRating = value.crimeRating.trim();
      // Validate against the CrimeRating type
      if (
        potentialRating === CRIME_RATINGS.HIGH ||
        potentialRating === CRIME_RATINGS.MODERATE ||
        potentialRating === CRIME_RATINGS.LOW
      ) {
        rating = potentialRating as CrimeRating;
      }
    }
    // If rating not found, try parsing score from object
    if (!rating && "crimeScore" in value) {
      if (typeof value.crimeScore === "string" || typeof value.crimeScore === "number") {
        numericalScore = parseNumberFromString(value.crimeScore);
      }
    }
  }
  // 2. Check if value is a string (could be rating or numerical score)
  else if (typeof value === "string") {
    const trimmedValue = value.trim();
    // Validate against the CrimeRating type
    if (
      trimmedValue === CRIME_RATINGS.HIGH ||
      trimmedValue === CRIME_RATINGS.MODERATE ||
      trimmedValue === CRIME_RATINGS.LOW
    ) {
      rating = trimmedValue as CrimeRating;
    } else {
      numericalScore = parseNumberFromString(value); // Try parsing as number
    }
  }
  // 3. Check if value is a number
  else if (typeof value === "number") {
    numericalScore = value;
  }

  // Determine score contribution based on rating or numerical score
  if (rating) {
    // Use rating directly
    const multiplier = CRIME_RATING_MULTIPLIERS[rating] ?? 0;
    scoreContribution = MAX_SCORE * multiplier;
  } else if (numericalScore !== null) {
    // Use numerical thresholds as fallback
    if (numericalScore >= CRIME_SCORE_THRESHOLDS.high) {
      scoreContribution = MAX_SCORE * CRIME_RATING_MULTIPLIERS[CRIME_RATINGS.HIGH];
    } else if (numericalScore >= CRIME_SCORE_THRESHOLDS.medium) {
      scoreContribution = MAX_SCORE * CRIME_RATING_MULTIPLIERS[CRIME_RATINGS.MODERATE];
    } else {
      scoreContribution = MAX_SCORE * CRIME_RATING_MULTIPLIERS[CRIME_RATINGS.LOW];
    }
  } else {
    // If neither rating nor numerical score could be determined
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Invalid or unrecognized crime score format.",
    };
  }

  return { scoreContribution, maxPossibleScore: MAX_SCORE };
};

export const calculateFloodRisk = (
  floodDefencesItem: PropertyDataListItem | undefined,
  floodSourcesItem: PropertyDataListItem | undefined,
  floodedLast5YearsItem: PropertyDataListItem | undefined,
  detailedRiskAssessmentItem: PropertyDataListItem | undefined
): FactorProcessingResult => {
  let scoreContribution = 0;
  let maxPossibleScoreContribution = 0; // Tracks the potential score based on available data points
  const warnings: string[] = [];
  let factorsConsidered = 0;

  const FLOOD_FACTORS_MAX_SCORE = {
    last5Years: 50,
    defences: 20,
    sources: 15,
    assessment: 15,
  };

  // 1. Flooded in last 5 years (High impact)
  if (floodedLast5YearsItem !== undefined) {
    const flooded = parseYesNoUnknown(floodedLast5YearsItem.value);
    if (flooded === true) {
      scoreContribution += FLOOD_FACTORS_MAX_SCORE.last5Years;
    } else if (flooded === null) {
      warnings.push("Flooded in last 5 years status unknown/missing.");
    }
    // Max possible score added regardless of value, as long as item exists
    maxPossibleScoreContribution += FLOOD_FACTORS_MAX_SCORE.last5Years;
    factorsConsidered++;
  } else {
    warnings.push("Flooded in last 5 years data item missing.");
  }

  // 2. Flood Defences (Medium impact)
  if (floodDefencesItem !== undefined) {
    const defencesPresent = parseYesNoUnknown(floodDefencesItem.value);
    // Increase risk score if defences are *absent*
    if (defencesPresent === false) {
      scoreContribution += FLOOD_FACTORS_MAX_SCORE.defences;
    } else if (defencesPresent === null) {
      warnings.push("Flood defences status unknown/missing.");
    }
    maxPossibleScoreContribution += FLOOD_FACTORS_MAX_SCORE.defences;
    factorsConsidered++;
  } else {
    warnings.push("Flood defences data item missing.");
  }

  // 3. Flood Sources (Lower impact - presence indicates potential)
  if (floodSourcesItem !== undefined) {
    const sourcesValue = floodSourcesItem.value;
    let hasSources = false;
    if (
      typeof sourcesValue === "string" &&
      sourcesValue.trim().toLowerCase() !== "none" &&
      sourcesValue.trim() !== ""
    ) {
      hasSources = true;
    } else if (Array.isArray(sourcesValue) && sourcesValue.length > 0) {
      // Assuming array contains strings of sources
      hasSources = sourcesValue.some(
        (source) => typeof source === "string" && source.trim() !== ""
      );
    }

    if (hasSources) {
      scoreContribution += FLOOD_FACTORS_MAX_SCORE.sources;
    }
    // Check for explicitly missing/null
    if (sourcesValue === undefined || sourcesValue === null || sourcesValue === "N/A") {
      warnings.push("Flood sources data unknown/missing.");
    }
    maxPossibleScoreContribution += FLOOD_FACTORS_MAX_SCORE.sources;
    factorsConsidered++;
  } else {
    warnings.push("Flood sources data item missing.");
  }

  // 4. Detailed Assessment (Medium impact)
  if (detailedRiskAssessmentItem !== undefined) {
    const assessmentValue = detailedRiskAssessmentItem.value;
    let riskIndicated = false;
    if (typeof assessmentValue === "string") {
      const assessmentStatus = assessmentValue.toLowerCase();
      // Add points if assessment available *and indicates high risk* or if recommended (implying potential risk)
      if (assessmentStatus.includes("high risk") || assessmentStatus.includes("recommended")) {
        riskIndicated = true;
      }
    }
    // Add specific check for boolean true if that's a possible value
    else if (typeof assessmentValue === "boolean" && assessmentValue === true) {
      riskIndicated = true; // Assume boolean true means risk indicated or assessment available
    }

    if (riskIndicated) {
      scoreContribution += FLOOD_FACTORS_MAX_SCORE.assessment;
    }

    if (assessmentValue === undefined || assessmentValue === null || assessmentValue === "N/A") {
      warnings.push("Detailed flood risk assessment status unknown/missing.");
    }
    maxPossibleScoreContribution += FLOOD_FACTORS_MAX_SCORE.assessment;
    factorsConsidered++;
  } else {
    warnings.push("Detailed flood risk assessment data item missing.");
  }

  // Normalize score based on factors considered
  const normalizedScore =
    maxPossibleScoreContribution > 0
      ? (scoreContribution / maxPossibleScoreContribution) * MAX_SCORE
      : 0;

  return {
    scoreContribution: normalizedScore, // Return score normalized to 0-100 scale for flood risk
    maxPossibleScore: factorsConsidered > 0 ? MAX_SCORE : 0, // Indicate if any flood data was processed
    warning: warnings.length > 0 ? `Flood Risk issues: ${warnings.join(" ")}` : undefined,
  };
};

export const calculateCoastalErosionRisk = (
  item: PropertyDataListItem | undefined
): FactorProcessingResult => {
  const key = "coastalErosion";
  if (!item) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Coastal erosion data item missing.",
    };
  }

  const atRisk = parseYesNoUnknown(item.value);
  let scoreContribution = 0;
  let warning: string | undefined = undefined;
  let maxPossibleScore = 0; // Initialize to 0

  if (atRisk === true) {
    scoreContribution = MAX_SCORE;
    maxPossibleScore = MAX_SCORE;
  } else if (atRisk === false) {
    scoreContribution = 0;
    maxPossibleScore = MAX_SCORE;
  } else {
    // Unknown/other value - treat as missing for score calculation, but warn.
    scoreContribution = 0;
    maxPossibleScore = 0;
    warning = "Coastal erosion status unknown/missing.";
  }

  return { scoreContribution, maxPossibleScore, warning };
};

export const calculateMiningImpactRisk = (status: boolean | null): FactorProcessingResult => {
  let scoreContribution = 0;
  let warning: string | undefined = undefined;
  let maxPossibleScore = 0; // Assume 0 unless data is valid (not null)

  if (status === true) {
    // status: true means negative impact found
    scoreContribution = MAX_SCORE;
    maxPossibleScore = MAX_SCORE;
  } else if (status === false) {
    // status: false means positive terms found (no impact)
    scoreContribution = 0;
    maxPossibleScore = MAX_SCORE;
  } else {
    // status: null means unknown / not mentioned
    scoreContribution = 0;
    maxPossibleScore = 0; // Treat as missing for score calculation
    warning = "Mining impact status unknown/not mentioned.";
  }

  return { scoreContribution, maxPossibleScore, warning };
};

export const calculateAirportNoiseRisk = (
  item: PropertyDataListItem | undefined
): FactorProcessingResult => {
  const key = "airportNoiseAssessment";
  if (!item) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Airport noise data item missing.",
    };
  }
  if (item.value === undefined || item.value === null || item.value === "N/A") {
    return {
      scoreContribution: 0,
      maxPossibleScore: MAX_SCORE,
      warning: "Airport noise data missing.",
    };
  }

  const noiseLevel = String(item.value).toLowerCase(); // Convert ReactNode to string
  let scoreContribution = 0;

  if (noiseLevel.includes("high")) {
    scoreContribution = MAX_SCORE;
  } else if (noiseLevel.includes("medium")) {
    scoreContribution = MAX_SCORE * 0.6;
  } else if (noiseLevel.includes("low")) {
    scoreContribution = MAX_SCORE * 0.2;
  }
  // Assume 'none' or other values mean negligible risk

  return { scoreContribution, maxPossibleScore: MAX_SCORE };
};
