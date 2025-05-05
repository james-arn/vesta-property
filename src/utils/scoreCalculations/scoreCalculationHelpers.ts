import { MAX_EPC_SCORE, MAX_SCORE, MIN_EPC_SCORE } from "@/constants/scoreConstants";

/**
 * Converts a raw EPC score (potentially 1-100+) into a normalized score (0-100)
 * where higher is better (more energy efficient).
 * Handles null or undefined inputs by returning a middling score (50).
 * @param rawEpcScore The raw EPC score number (e.g., from EPC certificate).
 * @returns A normalized score from 0 to 100.
 */
export const calculateEpcScoreValue = (rawEpcScore: number | null | undefined): number => {
  if (rawEpcScore === null || rawEpcScore === undefined) {
    console.warn("EPC score is null or undefined, returning default score 50.");
    return MAX_SCORE / 2; // Return a neutral score if EPC is unknown
  }

  // Clamp the raw score to the expected range (e.g., 1-100, though EPC can exceed 100)
  // We use MIN_EPC_SCORE and MAX_EPC_SCORE constants if defined, else default 0-100
  const lowerBound = MIN_EPC_SCORE ?? 0;
  const upperBound = MAX_EPC_SCORE ?? 100;
  const clampedScore = Math.max(lowerBound, Math.min(rawEpcScore, upperBound));

  // Normalize the clamped score to our 0-100 dashboard scale
  // Assuming a linear mapping for now
  const normalizedScore = ((clampedScore - lowerBound) / (upperBound - lowerBound)) * MAX_SCORE;

  // Ensure the final score is within 0-100
  return Math.max(0, Math.min(Math.round(normalizedScore), MAX_SCORE));
};

/**
 * Maps an EPC letter grade (A-G) to a representative numerical score.
 * Used as a fallback when only the grade is available.
 * @param grade The EPC letter grade (case-insensitive).
 * @returns A representative numerical score, or null if grade is invalid.
 */
export const mapGradeToScore = (grade: string | null): number | null => {
  if (!grade) return null;
  const upperGrade = grade.toUpperCase();
  // TODO: Consider moving this mapping to scoreConstants.ts
  const mapping: Record<string, number> = {
    A: 95,
    B: 85,
    C: 75,
    D: 60,
    E: 50,
    F: 40,
    G: 20,
  };
  return mapping[upperGrade] ?? null;
};
