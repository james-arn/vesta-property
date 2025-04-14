import { EpcBandInfo } from "@/types/epc"; // Assuming type location

export const formatEPCBandInfo = (band: EpcBandInfo | undefined | null): string => {
  if (!band) return "N/A";
  // Ensure max is treated as string if necessary, although EPC types likely handle this.
  const rangeMax = typeof band.range.max === "string" ? band.range.max : String(band.range.max);
  return `${band.letter} (${band.range.min}-${rangeMax})`;
};

/**
 * Formats a number as GBP currency.
 * Returns 'Not Available' if the value is null or undefined.
 */
export const formatCurrencyGBP = (
  value: number | null | undefined,
  maximumFractionDigits: number = 0
): string => {
  if (value === null || value === undefined) {
    return "Not Available";
  }
  return value.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits,
  });
};

/**
 * Formats a number as a percentage string.
 * Returns 'Not Available' if the value is null or undefined.
 */
export const formatPercentage = (
  value: number | null | undefined,
  decimalPlaces: number = 2
): string => {
  if (value === null || value === undefined) {
    return "Not Available";
  }
  // Multiply by 100 to convert decimal to percentage
  return `${(value * 100).toFixed(decimalPlaces)}%`;
};
