/**
 * Converts polar coordinates (angle, radius) to Cartesian coordinates (x, y).
 * @param centerX - The x-coordinate of the center point.
 * @param centerY - The y-coordinate of the center point.
 * @param radius - The radius.
 * @param angleInDegrees - The angle in degrees.
 * @returns The Cartesian coordinates {x, y}.
 */
const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

/**
 * Describes an SVG arc path.
 * @param x - The x-coordinate of the center point.
 * @param y - The y-coordinate of the center point.
 * @param radius - The radius of the arc.
 * @param startAngle - The starting angle in degrees (0 is at the 12 o'clock position).
 * @param endAngle - The ending angle in degrees.
 * @returns The SVG path data string ("d" attribute value).
 */
export const describeArc = (
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string => {
  // Ensure endAngle is corrected if it crosses the 360 boundary relative to start
  // and handle potential floating point issues for comparison
  let normalizedEndAngle = endAngle;
  while (normalizedEndAngle < startAngle - 0.001) {
    normalizedEndAngle += 360;
  }

  // Calculate points using the correct angles
  const startPoint = polarToCartesian(x, y, radius, startAngle);
  const endPoint = polarToCartesian(x, y, radius, normalizedEndAngle);

  const angleDiff = normalizedEndAngle - startAngle;

  // Determine the large arc flag based on the angle difference
  const largeArcFlag = angleDiff <= 180 ? "0" : "1";

  // Determine the sweep flag (1 for clockwise, 0 for counter-clockwise)
  // Since we draw from 270 towards 90, it's clockwise.
  const sweepFlag = "1";

  // Handle cases where start and end points are identical or very close
  if (Math.abs(angleDiff) < 0.001) {
    // No arc to draw
    return "";
  }
  // If it's effectively a full circle, draw two semi-circles
  if (Math.abs(angleDiff) >= 359.999) {
    const midAngle = startAngle + 180;
    const midPoint = polarToCartesian(x, y, radius, midAngle);
    return [
      "M",
      startPoint.x,
      startPoint.y,
      "A",
      radius,
      radius,
      0,
      0,
      sweepFlag,
      midPoint.x,
      midPoint.y, // First semi-circle
      "A",
      radius,
      radius,
      0,
      0,
      sweepFlag,
      endPoint.x,
      endPoint.y, // Second semi-circle
    ].join(" ");
  }

  // Standard arc path: M -> A
  const d = [
    "M",
    startPoint.x,
    startPoint.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    sweepFlag,
    endPoint.x,
    endPoint.y,
  ].join(" ");

  return d;
};
