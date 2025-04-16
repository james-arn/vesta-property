import {
  AIRPORT_NOISE_CATEGORY_MULTIPLIERS,
  CRIME_RATINGS,
  CRIME_RATING_MULTIPLIERS,
  CRIME_SCORE_THRESHOLDS,
  FLOOD_RISK_LEVEL_MULTIPLIERS,
  MAX_SCORE,
} from "@/constants/scoreConstants";
import { CrimeRating } from "@/hooks/useCrimeScore"; // Import CrimeRating type
import { FloodRisk } from "@/types/premiumStreetData"; // Added import
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
  const internalWarnings: string[] = []; // Use a local array for warnings

  const FLOOD_FACTORS_MAX_SCORE = {
    last5Years: 50,
    defences: 20,
    sources: 15,
    assessment: 15,
  } as const; // Use 'as const' for stricter typing

  // --- Calculate score for each factor --- //

  // 1. Flooded in last 5 years
  const last5YearsResult = (() => {
    if (floodedLast5YearsItem !== undefined) {
      const flooded = parseYesNoUnknown(floodedLast5YearsItem.value);
      const score = flooded === true ? FLOOD_FACTORS_MAX_SCORE.last5Years : 0;
      if (flooded === null) {
        internalWarnings.push("Flooded in last 5 years status unknown/missing.");
      }
      return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.last5Years };
    } else {
      internalWarnings.push("Flooded in last 5 years data item missing.");
      return { score: 0, maxScore: 0 };
    }
  })();

  // 2. Flood Defences
  const defencesResult = (() => {
    if (floodDefencesItem !== undefined) {
      const defencesPresent = parseYesNoUnknown(floodDefencesItem.value);
      // Score increases if defences are *absent*
      const score = defencesPresent === false ? FLOOD_FACTORS_MAX_SCORE.defences : 0;
      if (defencesPresent === null) {
        internalWarnings.push("Flood defences status unknown/missing.");
      }
      return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.defences };
    } else {
      internalWarnings.push("Flood defences data item missing.");
      return { score: 0, maxScore: 0 };
    }
  })();

  // 3. Flood Sources
  const sourcesResult = (() => {
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
        hasSources = sourcesValue.some(
          (source) => typeof source === "string" && source.trim() !== ""
        );
      }
      const score = hasSources ? FLOOD_FACTORS_MAX_SCORE.sources : 0;
      if (sourcesValue === undefined || sourcesValue === null || sourcesValue === "N/A") {
        internalWarnings.push("Flood sources data unknown/missing.");
      }
      return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.sources };
    } else {
      internalWarnings.push("Flood sources data item missing.");
      return { score: 0, maxScore: 0 };
    }
  })();

  // Type guard (can be moved outside if preferred)
  const isFloodRisk = (value: unknown): value is FloodRisk => {
    if (typeof value !== "object" || value === null || React.isValidElement(value)) {
      return false;
    }
    const obj = value as Record<string, unknown>;
    const hasRivers =
      "rivers_and_seas" in obj &&
      (obj.rivers_and_seas === null || typeof obj.rivers_and_seas === "object");
    const hasSurface =
      "surface_water" in obj &&
      (obj.surface_water === null || typeof obj.surface_water === "object");
    return hasRivers || hasSurface;
  };

  // 4. Detailed Assessment
  const assessmentResult = (() => {
    if (detailedRiskAssessmentItem !== undefined) {
      const assessmentValue = detailedRiskAssessmentItem.value;
      let score = 0;

      if (isFloodRisk(assessmentValue)) {
        const floodRiskData = assessmentValue;
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
            score = FLOOD_FACTORS_MAX_SCORE.assessment * highestMultiplier;
          } else {
            if (!internalWarnings.some((w) => w.startsWith("Unrecognized flood risk level:"))) {
              internalWarnings.push("Could not determine flood risk score from assessment levels.");
            }
          }
        } else {
          internalWarnings.push("Flood risk assessment present but risk levels missing.");
        }
      } else if (
        assessmentValue === undefined ||
        assessmentValue === null ||
        assessmentValue === "N/A"
      ) {
        internalWarnings.push("Detailed flood risk assessment data missing or N/A.");
      } else {
        internalWarnings.push("Unexpected format for detailed flood risk assessment data.");
      }
      return { score, maxScore: FLOOD_FACTORS_MAX_SCORE.assessment };
    } else {
      internalWarnings.push("Detailed flood risk assessment data item missing.");
      return { score: 0, maxScore: 0 };
    }
  })();

  // --- Aggregate results --- //
  const totalScoreContribution =
    last5YearsResult.score + defencesResult.score + sourcesResult.score + assessmentResult.score;

  const totalMaxPossibleScoreContribution =
    last5YearsResult.maxScore +
    defencesResult.maxScore +
    sourcesResult.maxScore +
    assessmentResult.maxScore;

  const normalizedScore =
    totalMaxPossibleScoreContribution > 0
      ? (totalScoreContribution / totalMaxPossibleScoreContribution) * MAX_SCORE
      : 0;

  const factorsConsidered = [
    last5YearsResult,
    defencesResult,
    sourcesResult,
    assessmentResult,
  ].filter((result) => result.maxScore > 0).length;

  return {
    scoreContribution: normalizedScore,
    maxPossibleScore: factorsConsidered > 0 ? MAX_SCORE : 0,
    warning:
      internalWarnings.length > 0 ? `Flood Risk issues: ${internalWarnings.join(" ")}` : undefined,
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
