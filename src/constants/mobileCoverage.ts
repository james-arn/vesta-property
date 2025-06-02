export const MOBILE_COVERAGE_LABELS = {
  0: "None",
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Excellent",
} as const;

export type MobileCoverageValue = keyof typeof MOBILE_COVERAGE_LABELS;
