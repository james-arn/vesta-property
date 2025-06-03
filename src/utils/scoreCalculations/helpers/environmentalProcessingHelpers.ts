import {
  AIRPORT_NOISE_CATEGORY_MULTIPLIERS,
  CRIME_RATINGS,
  CRIME_RATING_MULTIPLIERS,
  CRIME_SCORE_THRESHOLDS,
  FLOOD_RISK_LEVEL_MULTIPLIERS,
  MAX_SCORE,
} from "@/constants/scoreConstants";
import { CrimeRating } from "@/hooks/useCrimeScore"; // Import CrimeRating type
import { FloodRisk } from "@/types/premiumStreetData";
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
  floodDefences: boolean | null,
  floodSources: string[] | null,
  floodedInLastFiveYears: boolean | null,
  detailedFloodRiskAssessment: FloodRisk | null
): FactorProcessingResult => {
  const internalWarnings: string[] = [];
  let hasDetailedAssessmentData = false; // Flag to track if detailed assessment is valid

  const FLOOD_FACTORS_MAX_SCORE = {
    last5Years: 50,
    defences: 20,
    sources: 15,
    assessment: 15, // This represents the score if detailed assessment is present and positive
  } as const;

  // --- Calculate score for each factor --- //

  // 1. Flooded in last 5 years
  const last5YearsResult = (() => {
    const score = floodedInLastFiveYears === true ? FLOOD_FACTORS_MAX_SCORE.last5Years : 0;
    if (floodedInLastFiveYears === null && !hasDetailedAssessmentData) {
      internalWarnings.push("Flooded in last 5 years: Status unknown/missing.");
    }
    // Max score is always possible as we expect this data (even if null)
    return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.last5Years };
  })();

  // 2. Flood Defences
  const defencesResult = (() => {
    // Use the direct boolean value
    // Score if defences are NOT present (true = defences exist, so risk is lower, score contribution is 0)
    // If defencesPresent is false (no defences), then it contributes to risk score.
    const score = floodDefences === false ? FLOOD_FACTORS_MAX_SCORE.defences : 0;
    if (floodDefences === null && !hasDetailedAssessmentData) {
      internalWarnings.push("Flood defences: Status unknown/missing.");
    }
    return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.defences };
  })();

  // 3. Flood Sources
  const sourcesResult = (() => {
    let hasSources = false;
    if (Array.isArray(floodSources) && floodSources.length > 0) {
      hasSources = floodSources.some(
        (source) => typeof source === "string" && source.trim() !== ""
      );
    }
    const score = hasSources ? FLOOD_FACTORS_MAX_SCORE.sources : 0;
    if (floodSources === null && !hasDetailedAssessmentData) {
      internalWarnings.push("Flood sources: Data unknown/missing.");
    }
    return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.sources };
  })();

  // 4. Detailed Assessment
  const assessmentResult = (() => {
    let score = 0;
    let maxScoreForAssessment = 0; // Default to 0, becomes active if assessment data is present

    if (detailedFloodRiskAssessment) {
      hasDetailedAssessmentData = true; // Set flag if detailed assessment is valid
      maxScoreForAssessment = FLOOD_FACTORS_MAX_SCORE.assessment; // Activate max score for this part
      const floodRiskData = detailedFloodRiskAssessment;
      const riskLevels = [floodRiskData.rivers_and_seas?.risk, floodRiskData.surface_water?.risk]
        .map((risk) => (risk ? risk.toLowerCase() : undefined))
        .filter((risk): risk is string => !!risk);

      if (riskLevels.length > 0) {
        const highestMultiplier = riskLevels.reduce((maxMultiplier, currentRisk) => {
          const currentMultiplier = FLOOD_RISK_LEVEL_MULTIPLIERS[currentRisk] ?? -1;
          if (currentMultiplier === -1) {
            internalWarnings.push(`Unrecognized flood risk level: '${currentRisk}'.`);
          }
          return Math.max(maxMultiplier, currentMultiplier);
        }, -1);

        if (highestMultiplier >= 0) {
          // Score contribution from detailed assessment is based on its own max (e.g., 15 points)
          score = FLOOD_FACTORS_MAX_SCORE.assessment * highestMultiplier;
        } else {
          if (!internalWarnings.some((w) => w.startsWith("Unrecognized flood risk level:"))) {
            internalWarnings.push("Could not determine flood risk score from assessment levels.");
          }
          // If levels are unrecognized, it implies higher risk, so no positive score contribution from detailed assessment.
        }
      } else {
        internalWarnings.push("Flood risk assessment present but risk levels missing.");
        // If present but no levels, imply higher risk, no positive score contribution
      }
    } else {
      // No detailed assessment data, so this part contributes 0 to score and 0 to max possible for this sub-factor.
      // Warnings for missing *detailed* assessment are handled by the presence of `hasDetailedAssessmentData` flag in other sections.
    }
    return { score, maxScore: maxScoreForAssessment };
  })();

  // --- Consolidate results --- //
  const totalScoreContribution =
    last5YearsResult.score + defencesResult.score + sourcesResult.score + assessmentResult.score; // Risk score (higher means more risk)

  // Max possible score considers if detailed assessment was available to contribute its part
  const totalMaxPossibleScore =
    last5YearsResult.maxScore +
    defencesResult.maxScore +
    sourcesResult.maxScore +
    assessmentResult.maxScore; // This will be 0 if detailed assessment was null

  const finalWarning = internalWarnings.length > 0 ? internalWarnings.join(" ") : undefined;

  return {
    scoreContribution: totalScoreContribution,
    maxPossibleScore: totalMaxPossibleScore,
    warning: finalWarning,
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

export const calculateAirportNoiseRisk = (
  item: PropertyDataListItem | undefined
): FactorProcessingResult => {
  // Initial checks for missing item or unusable value
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

  // Helper to determine category and potential initial warning
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

  // If there was an immediate warning during category determination
  if (initialWarning) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: initialWarning,
    };
  }

  // If category is valid, calculate score
  if (category && category in AIRPORT_NOISE_CATEGORY_MULTIPLIERS) {
    const multiplier = AIRPORT_NOISE_CATEGORY_MULTIPLIERS[category];
    const scoreContribution = MAX_SCORE * multiplier;
    const maxPossibleScore = MAX_SCORE;
    return { scoreContribution, maxPossibleScore };
  }

  // If category was not found or invalid (and no initial warning)
  return {
    scoreContribution: 0,
    maxPossibleScore: 0,
    warning: "Could not determine airport noise category from provided data.",
  };
};

interface ConservationAreaDetails {
  conservationAreaDataAvailable: boolean | null;
  conservationArea: string | null;
}

export const calculateConservationAreaRisk = (
  details: ConservationAreaDetails | undefined | null
): FactorProcessingResult => {
  if (!details) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Conservation area details object missing.",
    };
  }

  const { conservationAreaDataAvailable, conservationArea } = details;

  // Check if data availability itself is unknown
  if (conservationAreaDataAvailable === null || conservationAreaDataAvailable === undefined) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Conservation area data availability unknown.",
    };
  }

  // If data is explicitly marked as unavailable
  if (conservationAreaDataAvailable === false) {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Conservation area data marked as unavailable.",
    };
  }

  // Data is available, now check the status
  // conservationArea being a non-empty string means it IS in a conservation area (high risk)
  if (
    conservationArea !== null &&
    typeof conservationArea === "string" &&
    conservationArea.trim() !== ""
  ) {
    return {
      scoreContribution: MAX_SCORE,
      maxPossibleScore: MAX_SCORE,
    };
  }
  // conservationArea being null or empty string means it IS NOT in a conservation area (zero risk)
  else if (
    conservationArea === null ||
    (typeof conservationArea === "string" && conservationArea.trim() === "")
  ) {
    return {
      scoreContribution: 0,
      maxPossibleScore: MAX_SCORE,
    };
  }
  // Should not happen if conservationAreaDataAvailable is true, but handle defensively
  else {
    return {
      scoreContribution: 0,
      maxPossibleScore: 0,
      warning: "Conservation area status unclear despite data being available.",
    };
  }
};
