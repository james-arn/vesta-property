import {
  GROUND_RENT_COST_SCORES,
  GROUND_RENT_THRESHOLDS,
  SERVICE_CHARGE_COST_SCORES,
  SERVICE_CHARGE_THRESHOLDS,
} from "@/constants/scoreConstants";
import { DataStatus } from "@/types/property";
import { parseMonetaryValue } from "@/utils/formatting";

export const calculateServiceChargeCostScore = (
  serviceChargeValue?: string | number | null,
  itemStatus?: DataStatus | null
): number => {
  if (itemStatus && itemStatus !== DataStatus.FOUND_POSITIVE) {
    return SERVICE_CHARGE_COST_SCORES.UNKNOWN; // Use UNKNOWN if status isn't positive
  }

  const numericValue = parseMonetaryValue(serviceChargeValue);

  // If service charge is explicitly not found or unparseable, use UNKNOWN.
  // If it's parseable as 0 or less, assume it's negligible for cost calculation.
  if (numericValue === null) {
    return SERVICE_CHARGE_COST_SCORES.UNKNOWN;
  }
  if (numericValue <= 0) {
    return 0; // Zero cost score if £0 or less
  }
  if (numericValue <= SERVICE_CHARGE_THRESHOLDS.LOW) {
    return SERVICE_CHARGE_COST_SCORES.LOW;
  }
  if (numericValue <= SERVICE_CHARGE_THRESHOLDS.MEDIUM) {
    return SERVICE_CHARGE_COST_SCORES.MEDIUM;
  }
  return SERVICE_CHARGE_COST_SCORES.HIGH;
};

// Helper to calculate Ground Rent Cost Score
export const calculateGroundRentCostScore = (
  groundRentValue?: string | number | null,
  itemStatus?: DataStatus | null
): number => {
  if (itemStatus && itemStatus !== DataStatus.FOUND_POSITIVE) {
    return GROUND_RENT_COST_SCORES.UNKNOWN; // Use UNKNOWN if status isn't positive
  }
  if (groundRentValue === null || groundRentValue === undefined) {
    return GROUND_RENT_COST_SCORES.UNKNOWN;
  }
  if (typeof groundRentValue === "string" && groundRentValue.toLowerCase() === "peppercorn") {
    return GROUND_RENT_COST_SCORES.PEPPERCORN;
  }

  const numericValue = parseMonetaryValue(groundRentValue);

  if (numericValue === null) {
    return GROUND_RENT_COST_SCORES.UNKNOWN;
  }
  if (numericValue <= 0) {
    // Treat 0 or less also as peppercorn/negligible
    return GROUND_RENT_COST_SCORES.PEPPERCORN;
  }
  if (numericValue <= GROUND_RENT_THRESHOLDS.LOW) {
    return GROUND_RENT_COST_SCORES.LOW;
  }
  if (numericValue <= GROUND_RENT_THRESHOLDS.MEDIUM) {
    return GROUND_RENT_COST_SCORES.MEDIUM;
  }
  return GROUND_RENT_COST_SCORES.HIGH;
};
