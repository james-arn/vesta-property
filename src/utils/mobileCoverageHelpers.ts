import { MOBILE_COVERAGE_LABELS, MobileCoverageValue } from "@/constants/mobileCoverage";

export const getMobileCoverageLabel = (value: number | null): string => {
  if (value === null) return "Unknown";
  const validValue = value as MobileCoverageValue;
  return MOBILE_COVERAGE_LABELS[validValue] || "Unknown";
};
