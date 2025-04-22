/**
 * Calculates an HSL hue value (0-120, Red-Yellow-Green) based on a percentage.
 * Lower percentages map towards red, higher percentages map towards green.
 * @param percentage The percentage value (0-100).
 * @returns The corresponding HSL hue value (0-120).
 */
export const calculateHueFromPercentage = (percentage: number): number => {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  if (clampedPercentage <= 50) {
    // Map 0-50% to Hue 0-60 (Red to Yellow)
    return (clampedPercentage / 50) * 60;
  } else {
    // Map 50-100% to Hue 60-120 (Yellow to Green)
    return 60 + ((clampedPercentage - 50) / 50) * 60;
  }
};
