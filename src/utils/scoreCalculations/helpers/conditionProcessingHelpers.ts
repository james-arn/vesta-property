import { ChecklistKey } from "@/constants/checklistKeys";
import {
  BUILDING_SAFETY_NEGATIVE_MODIFIER,
  BUILDING_SAFETY_POSITIVE_MODIFIER,
  BUILDING_SAFETY_SEVERE_NEGATIVE_MODIFIER,
  BUILDING_SAFETY_SEVERE_NEGATIVE_TERMS,
} from "@/constants/scoreConstants";
import { Occupancy } from "@/types/premiumStreetData";
import { PropertyDataListItem } from "@/types/property";
import {
  buildingSafetyTermsNegative,
  buildingSafetyTermsPositive,
} from "../../../constants/keyTerms";

/**
 * Finds the value of a specific checklist item by its key.
 * @param items - The array of PropertyDataListItem objects.
 * @param key - The key of the item to find.
 * @returns The value of the found item, or undefined.
 */
export const findItemValue = <T = any>(
  items: PropertyDataListItem[],
  key: ChecklistKey
): T | undefined => {
  const item = items.find((i) => i.key === key);
  return item?.value as T | undefined;
};

/**
 * Maps an EPC rating (A-G) to a numerical score (0-100).
 * @param rating - The EPC rating string.
 * @returns A numerical score representing the rating.
 */
export const mapEpcRatingToScore = (rating: string | undefined): number => {
  if (!rating) return 30; // Default for missing
  const upperRating = rating.toUpperCase();
  switch (upperRating) {
    case "A":
      return 100;
    case "B":
      return 85;
    case "C":
      return 70;
    case "D":
      return 55;
    case "E":
      return 40;
    case "F":
      return 25;
    case "G":
      return 10;
    default:
      return 30; // Default for unknown/other values
  }
};

/**
 * Calculates a score modifier based on the construction age band.
 * Newer properties generally get a positive modifier, older ones negative.
 * @param ageBand - The construction age band string.
 * @returns A numerical modifier value.
 */
export const mapAgeBandToModifier = (ageBand: string | undefined): number => {
  if (!ageBand) return 0;

  // Check for newest properties first (highest scores)
  if (ageBand.includes("2020")) return 10;
  if (ageBand.includes("2010-2019")) return 8;
  if (ageBand.includes("2010")) return 7;

  // Check for newer properties
  if (ageBand.includes("2000-2009")) return 5;
  if (ageBand.includes("2000")) return 4;
  if (ageBand.includes("1990")) return 3;

  // Middle-aged properties
  if (ageBand.includes("1980")) return 1;
  if (ageBand.includes("1970")) return 0;

  // Older properties
  if (ageBand.includes("1960")) return -3;
  if (ageBand.includes("1950")) return -5;

  // Oldest properties
  if (ageBand.includes("1900-1949")) return -8;
  if (ageBand.includes("pre-1900")) return -10;

  return 0;
};

/**
 * Generates a qualitative label based on the final condition score.
 * @param score - The final numerical score (0-100).
 * @returns A descriptive string label.
 */
export const getConditionScoreLabel = (score: number): string => {
  if (score >= 80) return "Very Good Condition";
  if (score >= 65) return "Good Condition";
  if (score >= 45) return "Average Condition";
  if (score >= 30) return "Poor Condition";
  return "Very Poor Condition";
};

/**
 * Calculates a score modifier based on heating type keywords.
 * @param heatingValue - The string value describing the heating.
 * @returns A numerical modifier value.
 */
export const mapHeatingTypeToModifier = (heatingValue: string | undefined): number => {
  if (!heatingValue) return -1; // Small penalty if missing

  const lowerCaseValue = heatingValue.toLowerCase();

  if (lowerCaseValue.includes("gas") && lowerCaseValue.includes("central")) return 3;
  if (lowerCaseValue.includes("gas")) return 2;
  if (lowerCaseValue.includes("modern boiler")) return 4; // Assume efficient
  if (lowerCaseValue.includes("new boiler")) return 4;
  if (lowerCaseValue.includes("electric storage") || lowerCaseValue.includes("storage heater"))
    return -3;
  if (lowerCaseValue.includes("electric")) return -1;
  if (lowerCaseValue.includes("oil")) return -2;
  if (lowerCaseValue.includes("underfloor")) return 5; // Often seen as premium

  return 0; // Neutral if keywords not matched
};

/**
 * Calculates a score modifier based on windows type keywords.
 * @param windowsValue - The string value describing the windows.
 * @returns A numerical modifier value.
 */
export const mapWindowsToModifier = (windowsValue: string | undefined): number => {
  if (!windowsValue) return -1; // Small penalty if missing

  const lowerCaseValue = windowsValue.toLowerCase();

  let modifier = 0;

  // Glazing type
  if (lowerCaseValue.includes("triple glazed") || lowerCaseValue.includes("triple glazing"))
    modifier += 5;
  else if (lowerCaseValue.includes("double glazed") || lowerCaseValue.includes("double glazing"))
    modifier += 3;
  else if (lowerCaseValue.includes("single glazed") || lowerCaseValue.includes("single glazing"))
    modifier -= 5;
  else modifier += 0; // Assume at least double if not specified?

  // Frame material (less impact than glazing)
  if (lowerCaseValue.includes("upvc")) modifier += 1;
  else if (lowerCaseValue.includes("wood") || lowerCaseValue.includes("timber"))
    modifier -= 1; // Higher maintenance
  else if (lowerCaseValue.includes("aluminium")) modifier += 0;

  // Clamp modifier to prevent excessive swings, e.g., between -5 and +6
  return Math.max(-5, Math.min(6, modifier));
};

/**
 * Calculates a score modifier based on floor material keywords.
 * Assumes certain materials might indicate better/worse condition or insulation.
 * @param floorValue - The string value describing the floor material.
 * @returns A numerical modifier value (0 if value is missing).
 */
export const mapFloorMaterialToModifier = (floorValue: string | undefined): number => {
  if (!floorValue) return 0; // No penalty if missing

  const lowerCaseValue = floorValue.toLowerCase();

  if (lowerCaseValue.includes("concrete")) return 1;
  if (lowerCaseValue.includes("wood") || lowerCaseValue.includes("timber")) return 0;
  // Add more specific floor types if known (e.g., specific wood types, tile)

  return 0; // Neutral if keywords not matched
};

/**
 * Calculates a score modifier based on roof material keywords.
 * Assumes certain materials might indicate better/worse condition or longevity.
 * @param roofValue - The string value describing the roof material.
 * @returns A numerical modifier value (0 if value is missing).
 */
export const mapRoofMaterialToModifier = (roofValue: string | undefined): number => {
  if (!roofValue) return 0; // No penalty if missing

  const lowerCaseValue = roofValue.toLowerCase();

  if (lowerCaseValue.includes("slate")) return 3;
  if (lowerCaseValue.includes("tile") || lowerCaseValue.includes("tiled")) return 2;
  if (lowerCaseValue.includes("metal")) return 1;
  if (lowerCaseValue.includes("asphalt") || lowerCaseValue.includes("felt")) return -1;
  if (lowerCaseValue.includes("flat")) return -5; // Flat roofs often have shorter lifespan
  if (lowerCaseValue.includes("thatched")) return -5; // High maintenance

  return 0; // Neutral if keywords not matched
};

/**
 * Calculates a score modifier based on wall material keywords.
 * Assumes certain materials might indicate better/worse condition or insulation.
 * @param wallValue - The string value describing the wall material.
 * @returns A numerical modifier value (0 if value is missing).
 */
export const mapWallMaterialToModifier = (wallValue: string | undefined): number => {
  if (!wallValue) return 0; // No penalty if missing

  const lowerCaseValue = wallValue.toLowerCase();

  // Prioritize insulation mentions
  if (lowerCaseValue.includes("cavity wall insulation")) return 5;
  if (lowerCaseValue.includes("insulated")) return 3;

  // Material types
  if (lowerCaseValue.includes("brick")) return 2;
  if (lowerCaseValue.includes("stone")) return 1;
  if (lowerCaseValue.includes("concrete")) return 0;
  if (lowerCaseValue.includes("timber frame")) return -1;
  if (lowerCaseValue.includes("render")) return 0; // Could be good or bad
  if (lowerCaseValue.includes("clad") || lowerCaseValue.includes("cladding")) return -1; // Depends on type, but can hide issues

  // Specific issues
  if (lowerCaseValue.includes("single skin")) return -5;

  return 0; // Neutral if keywords not matched
};

/**
 * Calculates a score modifier based on building safety terms.
 * Evaluates an array of terms against predefined lists of positive and negative safety indicators.
 * Severe negative terms (like mould, damp, asbestos) have a larger negative impact.
 * @param terms - Array of building safety terms to evaluate
 * @returns A numerical modifier value (0 if no terms provided)
 */
export const mapBuildingSafetyToModifier = (terms: string[] | string): number => {
  if (!terms || (Array.isArray(terms) && terms.length === 0)) {
    return 0;
  }

  const termsArray = Array.isArray(terms) ? terms : [terms];

  const modifier = termsArray.reduce((acc, term) => {
    const lowerCaseTerm = term.toLowerCase();

    if (BUILDING_SAFETY_SEVERE_NEGATIVE_TERMS.includes(lowerCaseTerm)) {
      return acc + BUILDING_SAFETY_SEVERE_NEGATIVE_MODIFIER;
    }
    if (buildingSafetyTermsNegative.includes(lowerCaseTerm)) {
      return acc + BUILDING_SAFETY_NEGATIVE_MODIFIER;
    }
    if (buildingSafetyTermsPositive.includes(lowerCaseTerm)) {
      return acc + BUILDING_SAFETY_POSITIVE_MODIFIER;
    }
    return acc;
  }, 0);

  return modifier;
};

/**
 * Calculates a score modifier based on the occupancy status.
 * Assumes owner-occupied might be slightly better maintained.
 * @param occupancyStatus - The specific occupancy type string.
 * @returns A numerical modifier value (0 if status is missing/unknown).
 */
export const mapOccupancyStatusToModifier = (
  occupancyStatus: Occupancy["occupancy_type"] | undefined
): number => {
  if (!occupancyStatus) return 0; // No modifier if missing, warning handled elsewhere

  // Direct comparison using the imported type literals
  switch (occupancyStatus) {
    case "Owner-occupied":
      return 2;
    case "Rented (private)":
    case "Rented (social)":
      return -1;
    default:
      return 0; // Neutral for unknown statuses or if type doesn't match exactly
  }
};
