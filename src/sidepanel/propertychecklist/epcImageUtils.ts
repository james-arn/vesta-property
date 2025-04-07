// Standard EPC Band definitions

import { EpcBandInfo, RGBColor } from "@/types/epc";

// Reference colors are approximate, matching might need tuning
const EPC_BANDS: EpcBandInfo[] = [
  { letter: "A", range: { min: 92, max: "92+" }, referenceColorHex: "#008054", score: 92 },
  { letter: "B", range: { min: 81, max: 91 }, referenceColorHex: "#2c9f29", score: 81 },
  { letter: "C", range: { min: 69, max: 80 }, referenceColorHex: "#8DCE46", score: 69 },
  { letter: "D", range: { min: 55, max: 68 }, referenceColorHex: "#FFD500", score: 55 },
  { letter: "E", range: { min: 39, max: 54 }, referenceColorHex: "#f7af1d", score: 39 },
  { letter: "F", range: { min: 21, max: 38 }, referenceColorHex: "#ed6823", score: 21 },
  { letter: "G", range: { min: 1, max: 20 }, referenceColorHex: "#E9153B", score: 1 },
];

// Pre-calculate RGB values for reference colors
EPC_BANDS.forEach((band) => {
  band.referenceColorRgb = hexToRgb(band.referenceColorHex) ?? undefined; // Convert null to undefined
});

// --- Helper Functions ---
function hexToRgb(hex: string): RGBColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// --- Constants for color comparison ---
const COLOR_SIMILARITY_THRESHOLD = 45; // Was 55
const MIN_ALPHA_THRESHOLD = 200; // Ignore mostly transparent pixels
const IGNORE_COLOR_THRESHOLD = 50; // How close to pure white/black/grey to ignore
const MIN_PIXEL_COUNT_THRESHOLD = 10; // Minimum number of pixels for a color to be considered significant on the right side

// --- Threshold specifically for matching right-side chevrons ---
const RIGHT_SIDE_SIMILARITY_THRESHOLD = 60; // Was 50

// --- Threshold for comparing the two right-side chevrons directly ---
const CHEVRON_COLOR_SIMILARITY_THRESHOLD = 25; // Tight threshold

// --- Helper Functions (Required for new logic) ---

// Function to check if two RGB colors are similar (Euclidean distance)
// Takes optional threshold override
const areColorsSimilar = (
  color1: RGBColor,
  color2: RGBColor,
  threshold: number = COLOR_SIMILARITY_THRESHOLD // Default to the stricter scan threshold
): boolean => {
  // Check if colors are valid before calculating distance
  if (!color1 || !color2) return false;
  const dist = Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
  return dist < threshold;
};

// Function to check if a color is too close to white, black, or grey, or transparent
const isColorIgnored = (r: number, g: number, b: number, a: number): boolean => {
  if (a < MIN_ALPHA_THRESHOLD) return true; // Ignore transparent
  if (
    r > 255 - IGNORE_COLOR_THRESHOLD &&
    g > 255 - IGNORE_COLOR_THRESHOLD &&
    b > 255 - IGNORE_COLOR_THRESHOLD
  )
    return true; // Ignore white
  if (r < IGNORE_COLOR_THRESHOLD && g < IGNORE_COLOR_THRESHOLD && b < IGNORE_COLOR_THRESHOLD)
    return true; // Ignore black
  const avg = (r + g + b) / 3;
  const diff = Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg);
  if (diff < IGNORE_COLOR_THRESHOLD) return true; // Ignore grey
  return false;
};

// --- Dominant Color Finder Helper (using RelativeRegion with width/height) ---
interface RelativeRegion {
  x: number; // Fraction of width
  y: number; // Fraction of height
  width: number; // Fraction of width
  height: number; // Fraction of height
}

const getDominantColorInRegion = (
  ctx: CanvasRenderingContext2D,
  region: RelativeRegion,
  canvasWidth: number,
  canvasHeight: number,
  samplesX = 10,
  samplesY = 10
): RGBColor | null => {
  const startX = Math.floor(region.x * canvasWidth);
  const startY = Math.floor(region.y * canvasHeight);
  const regionWidth = Math.floor(region.width * canvasWidth);
  const regionHeight = Math.floor(region.height * canvasHeight);

  if (regionWidth <= 0 || regionHeight <= 0) return null;

  const points = Array.from({ length: samplesX * samplesY }, (_, i) => {
    const xIndex = i % samplesX;
    const yIndex = Math.floor(i / samplesX);
    const x = startX + Math.floor((xIndex / Math.max(1, samplesX - 1)) * (regionWidth - 1));
    const y = startY + Math.floor((yIndex / Math.max(1, samplesY - 1)) * (regionHeight - 1));
    return {
      x: Math.max(0, Math.min(x, canvasWidth - 1)),
      y: Math.max(0, Math.min(y, canvasHeight - 1)),
    };
  });

  const colorCounts = points
    .map((p) => {
      try {
        return ctx.getImageData(p.x, p.y, 1, 1).data;
      } catch {
        return null;
      }
    })
    .filter(
      (data): data is Uint8ClampedArray =>
        data !== null && !isColorIgnored(data[0], data[1], data[2], data[3])
    )
    .reduce(
      (acc, data) => {
        const colorKey = `${data[0]},${data[1]},${data[2]}`;
        acc[colorKey] = (acc[colorKey] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

  const dominantColorEntry = Object.entries(colorCounts).sort(
    ([, countA], [, countB]) => countB - countA
  )[0];

  if (!dominantColorEntry) return null;

  const [colorKey] = dominantColorEntry;
  const [r, g, b] = colorKey.split(",").map(Number);
  return { r, g, b };
};

// --- NEW: Function to Dynamically Find Band Regions ---
const findBandRegionsDynamically = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
): Record<string, RelativeRegion> | null => {
  const foundRegions: Record<string, RelativeRegion> = {}; // Regions found by COLOR
  const bandHeights: Record<string, number> = {}; // Store heights to calculate y positions
  const bandYs: Record<string, number> = {}; // Store top y positions

  const scanX = Math.floor(canvasWidth * 0.15); // Scan vertically around 15% from left (back from 25%)
  const scanWidth = Math.max(1, Math.floor(canvasWidth * 0.1)); // Keep wider (10%) horizontal line
  const stepY = 1; // Scan every pixel vertically
  const minColorStreak = 3; // Keep shorter streak (3)

  console.log(`[Dynamic Region Finder] Starting COLOR scan at x=${scanX}`);

  let lastY = 0;
  // --- Step 1: Find regions by direct color matching ---
  for (const band of EPC_BANDS) {
    const targetColor = band.referenceColorRgb;
    if (!targetColor) continue; // Skip if reference color missing
    let currentStreak = 0;
    let streakStartY = -1;
    const startScanY = lastY > 0 ? lastY + 5 : Math.floor(canvasHeight * 0.1); // Start scan lower if previous band found
    const endScanY = Math.floor(canvasHeight * 0.95);

    for (let y = startScanY; y < endScanY; y += stepY) {
      // Sample a few points horizontally for robustness
      let matchCount = 0;
      for (let xOffset = 0; xOffset < scanWidth; xOffset++) {
        const x = scanX + xOffset;
        if (x >= canvasWidth) continue; // Bounds check
        try {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          if (!isColorIgnored(pixel[0], pixel[1], pixel[2], pixel[3])) {
            const sampleColor = { r: pixel[0], g: pixel[1], b: pixel[2] };
            if (areColorsSimilar(sampleColor, targetColor)) {
              matchCount++;
            }
          }
        } catch (e) {
          /* Ignore sampling errors outside canvas */
        }
      }

      // --- Relax horizontal match requirement ---
      if (matchCount > scanWidth / 3) {
        // If majority of horizontal samples match
        if (streakStartY === -1) {
          streakStartY = y; // Start of potential streak
        }
        currentStreak++;
      } else {
        // Check if we just finished a valid streak
        if (currentStreak >= minColorStreak) {
          const bandTopY = streakStartY;
          const bandBottomY = y - stepY; // End of the streak
          const detectedHeight = bandBottomY - bandTopY;
          console.log(
            `[Dynamic Region Finder - Color] Found Band ${band.letter} at y=${bandTopY} to y=${bandBottomY} (Height: ${detectedHeight}px)`
          );

          if (detectedHeight > 0) {
            bandYs[band.letter] = bandTopY / canvasHeight;
            bandHeights[band.letter] = detectedHeight / canvasHeight;
            lastY = bandBottomY; // Update last found position
            // Break inner loop and move to next band
            currentStreak = 0;
            streakStartY = -1;
            break;
          }
        }
        // Reset streak if color doesn't match
        currentStreak = 0;
        streakStartY = -1;
      }
    }
    // Check if a streak was ongoing at the end of the scan
    if (currentStreak >= minColorStreak && streakStartY !== -1) {
      const bandTopY = streakStartY;
      const bandBottomY = endScanY - stepY;
      const detectedHeight = bandBottomY - bandTopY;
      console.log(
        `[Dynamic Region Finder - Color] Found Band ${band.letter} at end of scan y=${bandTopY} to y=${bandBottomY} (Height: ${detectedHeight}px)`
      );
      if (detectedHeight > 0) {
        bandYs[band.letter] = bandTopY / canvasHeight;
        bandHeights[band.letter] = detectedHeight / canvasHeight;
        lastY = bandBottomY;
      }
    }
  }

  Object.keys(bandYs).forEach((letter) => {
    if (bandHeights[letter]) {
      foundRegions[letter] = {
        x: 0.05,
        y: bandYs[letter],
        width: 0.25,
        height: bandHeights[letter],
      };
    }
  });

  const colorFoundCount = Object.keys(foundRegions).length;
  console.log(`[Dynamic Region Finder] Found ${colorFoundCount} regions by color scan.`);

  // --- Step 2: Attempt Interpolation/Extrapolation for missing bands ---
  EPC_BANDS.forEach((currentBand, index) => {
    const currentLetter = currentBand.letter;
    if (!foundRegions[currentLetter]) {
      // If band wasn't found by color
      const prevBand = index > 0 ? EPC_BANDS[index - 1] : null;
      const nextBand = index < EPC_BANDS.length - 1 ? EPC_BANDS[index + 1] : null;

      // Get regions IF they were found by color scan
      const prevRegion = prevBand ? foundRegions[prevBand.letter] : null;
      const nextRegion = nextBand ? foundRegions[nextBand.letter] : null;

      let estimatedY: number | null = null;
      let estimatedHeight: number | null = null;
      let estimated = false;

      if (prevRegion && nextRegion) {
        // Interpolate between two found neighbours
        const gapTopY = prevRegion.y + prevRegion.height;
        const gapHeight = nextRegion.y - gapTopY;
        // Check for a reasonable positive gap between the neighbours
        if (gapHeight > 0.005 && gapHeight < 0.2) {
          estimatedY = gapTopY;
          estimatedHeight = gapHeight;
          estimated = true;
          console.log(
            `[Dynamic Region Finder - Interpolate] Estimating ${currentLetter} between ${prevBand?.letter} and ${nextBand?.letter}`
          );
        } else {
          console.warn(
            `[Dynamic Region Finder - Interpolate] Unreasonable gap for ${currentLetter} (Gap: ${gapHeight.toFixed(3)}), cannot estimate.`
          );
        }
      } else if (prevRegion) {
        // Extrapolate downwards from found upper neighbour
        estimatedY = prevRegion.y + prevRegion.height;
        estimatedHeight = prevRegion.height; // Assume same height
        estimated = true;
        console.log(
          `[Dynamic Region Finder - Extrapolate] Estimating ${currentLetter} based on ${prevBand?.letter} above.`
        );
      } else if (nextRegion) {
        // Extrapolate upwards from found lower neighbour
        estimatedHeight = nextRegion.height; // Assume same height
        estimatedY = nextRegion.y - estimatedHeight;
        if (estimatedY > 0) {
          // Ensure Y is positive
          estimated = true;
          console.log(
            `[Dynamic Region Finder - Extrapolate] Estimating ${currentLetter} based on ${nextBand?.letter} below.`
          );
        } else {
          console.warn(
            `[Dynamic Region Finder - Extrapolate] Cannot estimate ${currentLetter} upwards from ${nextBand?.letter}, negative Y.`
          );
        }
      }

      // Add the estimated region if calculated successfully
      if (estimated && estimatedY !== null && estimatedHeight !== null && estimatedHeight > 0) {
        foundRegions[currentLetter] = {
          x: 0.05,
          y: estimatedY,
          width: 0.25,
          height: estimatedHeight,
        };
      }
    }
  });

  // --- Step 3: Final Check ---
  const finalFoundCount = Object.keys(foundRegions).length;
  console.log(`[Dynamic Region Finder] Found/Estimated ${finalFoundCount} band regions finally.`);

  // Require at least 5 bands total (found by color or estimated)
  if (finalFoundCount < 5) {
    console.error(
      `[Dynamic Region Finder] Failed to find/estimate enough band regions (${finalFoundCount} < 5).`
    );
    return null;
  }

  return foundRegions; // Return map containing both color-found and estimated regions
};

// --- Main Processing Function (Uses Dynamic Regions + Vertical Check + Chevron Compare) ---
export const processEpcImageDataUrl = async (
  dataUrl: string,
  debugCanvas: HTMLCanvasElement | null = null
): Promise<EpcBandResult> => {
  try {
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = (err) =>
        reject(new Error(`Failed to load image: ${err instanceof Event ? "event" : String(err)}`));
    });

    const canvas = debugCanvas ?? document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not get canvas context");
    ctx.drawImage(img, 0, 0);

    console.log(`[Canvas Process - Vertical Check] Image loaded: ${canvas.width}x${canvas.height}`);

    // 1. Find Band Regions Dynamically
    const dynamicBandRegions = findBandRegionsDynamically(ctx, canvas.width, canvas.height);

    if (!dynamicBandRegions) {
      return { error: "Failed to dynamically locate reference bands." };
    }

    // 2. Sample ACTUAL Colors from Dynamically Found Regions
    const actualReferenceColors: { color: RGBColor; bandInfo: EpcBandInfo }[] = EPC_BANDS.map(
      (bandInfo) => {
        const region = dynamicBandRegions[bandInfo.letter];
        if (!region) return null; // Skip if region wasn't found for this band

        // Sample dominant color from the *dynamically found* region
        const color = getDominantColorInRegion(ctx, region, canvas.width, canvas.height, 8, 4);

        if (color) {
          console.log(
            `[Canvas Process - VC] Actual sampled color for Band ${bandInfo.letter}:`,
            color,
            `at region y:${region.y.toFixed(2)}, h:${region.height.toFixed(2)}`
          );
          return { color, bandInfo }; // Use the *sampled* color as the reference
        }
        console.warn(
          `[Canvas Process - VC] Could not sample dominant color for Band ${bandInfo.letter} in its dynamic region.`
        );
        return null;
      }
    ).filter((item): item is { color: RGBColor; bandInfo: EpcBandInfo } => item !== null);

    if (actualReferenceColors.length < 2) {
      console.error(
        "[Canvas Process - VC] Could not reliably sample enough actual reference band colors."
      );
      return { error: "Could not sample reference colors from dynamic regions." };
    }

    // 3. Define NARROWER Right-Side Analysis Region
    const rightAnalysisRegion: RelativeRegion = { x: 0.75, y: 0.15, width: 0.2, height: 0.7 };

    // 4. Sample Pixels + Y Coordinates on Right Side
    const rightSamplesX = 20; // Fewer samples needed for narrower region
    const rightSamplesY = 60;
    const rightStartX = Math.floor(rightAnalysisRegion.x * canvas.width);
    const rightStartY = Math.floor(rightAnalysisRegion.y * canvas.height);
    const rightRegionWidth = Math.floor(rightAnalysisRegion.width * canvas.width);
    const rightRegionHeight = Math.floor(rightAnalysisRegion.height * canvas.height);
    if (rightRegionWidth <= 0 || rightRegionHeight <= 0)
      return { error: "Invalid image dimensions for analysis." };

    const rightSidePixelsData = Array.from({ length: rightSamplesX * rightSamplesY }, (_, i) => {
      const xIndex = i % rightSamplesX;
      const yIndex = Math.floor(i / rightSamplesX);
      const x =
        rightStartX +
        Math.floor((xIndex / Math.max(1, rightSamplesX - 1)) * (rightRegionWidth - 1));
      const y =
        rightStartY +
        Math.floor((yIndex / Math.max(1, rightSamplesY - 1)) * (rightRegionHeight - 1));
      const pixelPos = {
        x: Math.max(0, Math.min(x, canvas.width - 1)),
        y: Math.max(0, Math.min(y, canvas.height - 1)),
      };
      try {
        const pixelData = ctx.getImageData(pixelPos.x, pixelPos.y, 1, 1).data;
        if (!isColorIgnored(pixelData[0], pixelData[1], pixelData[2], pixelData[3])) {
          return { color: { r: pixelData[0], g: pixelData[1], b: pixelData[2] }, y: pixelPos.y }; // Store Y
        }
      } catch {
        /* ignore errors */
      }
      return null;
    }).filter((data): data is { color: RGBColor; y: number } => data !== null);

    // 5. Match Right-Side Pixels to PREDEFINED Reference Colors and Store Matches with Y coords
    interface BandMatchData {
      count: number;
      ySum: number;
    }
    const bandMatches: Record<string, BandMatchData> = {};

    rightSidePixelsData.forEach((pixelData) => {
      let closestMatchBand: EpcBandInfo | null = null;
      // Use the MORE LENIENT threshold for right-side matching
      let minDistance = RIGHT_SIDE_SIMILARITY_THRESHOLD;

      // Iterate through the original EPC_BANDS with predefined colors
      EPC_BANDS.forEach((band) => {
        // Use the predefined reference color for comparison
        const targetColor = band.referenceColorRgb;
        if (!targetColor) return; // Skip if predefined RGB is missing

        const dist = Math.sqrt(
          Math.pow(pixelData.color.r - targetColor.r, 2) +
            Math.pow(pixelData.color.g - targetColor.g, 2) +
            Math.pow(pixelData.color.b - targetColor.b, 2)
        );

        if (dist < minDistance) {
          minDistance = dist;
          closestMatchBand = band; // Store the matched band info
        }
      });

      // If a closest match within the threshold was found based on predefined colors
      if (closestMatchBand) {
        // Explicit type assertion
        const matchedBandInfo = closestMatchBand as EpcBandInfo;
        const bandKey = matchedBandInfo.letter;
        if (!bandMatches[bandKey]) {
          bandMatches[bandKey] = { count: 0, ySum: 0 };
        }
        bandMatches[bandKey].count++;
        bandMatches[bandKey].ySum += pixelData.y;
      }
    });

    console.log(
      "[Canvas Process - VC FixedRef] Match data (count, ySum) on right side:",
      bandMatches
    );

    // 6. Identify Significant Bands based on Count
    const significantBandKeys = Object.entries(bandMatches)
      .filter(([, data]) => data.count >= MIN_PIXEL_COUNT_THRESHOLD) // Use data.count
      .sort(([, dataA], [, dataB]) => dataB.count - dataA.count) // Sort by count
      .map(([bandKey]) => bandKey);

    console.log(
      "[Canvas Process - VC] Significant band keys (pre-validation):",
      significantBandKeys
    );

    // 7. Vertical Validation Filter
    const validatedBands: EpcBandInfo[] = significantBandKeys
      .map((bandKey) => {
        const bandInfo = EPC_BANDS.find((b) => b.letter === bandKey);
        const matchData = bandMatches[bandKey];
        const dynamicRegion = dynamicBandRegions[bandKey];

        if (!bandInfo || !matchData || !dynamicRegion) return null; // Should not happen if logic is correct

        const avgYRight = matchData.ySum / matchData.count / canvas.height; // Average relative Y on right
        const expectedYLeftCenter = dynamicRegion.y + dynamicRegion.height / 2; // Expected relative center Y on left
        const expectedHeightLeft = dynamicRegion.height; // Expected relative height on left

        const yDifference = Math.abs(avgYRight - expectedYLeftCenter);
        const verticalTolerance = expectedHeightLeft * 2.5; // Allow tolerance (+/- 2.5 band heights)

        console.log(
          `[Canvas Process - VC] Validation for ${bandKey}: AvgYRight=${avgYRight.toFixed(2)}, ExpectedYCenter=${expectedYLeftCenter.toFixed(2)}, Diff=${yDifference.toFixed(2)}, Tolerance=${verticalTolerance.toFixed(2)}`
        );

        if (yDifference <= verticalTolerance) {
          return bandInfo; // Validated!
        } else {
          console.warn(`[Canvas Process - VC] Band ${bandKey} failed vertical validation.`);
          return null; // Failed validation
        }
      })
      .filter((bandInfo): bandInfo is EpcBandInfo => bandInfo !== null);

    console.log(
      "[Canvas Process - VC] Validated significant bands:",
      validatedBands.map((b) => b.letter)
    );

    // --- NEW Step 7.5: Sample Combined Chevron Region Color ---
    // Use the existing rightAnalysisRegion, sample densely
    const sampledCombinedChevronColor = getDominantColorInRegion(
      ctx,
      rightAnalysisRegion,
      canvas.width,
      canvas.height,
      30,
      20
    );

    console.log(
      "[Canvas Process - Combined Chevron Check] Sampled Color:",
      sampledCombinedChevronColor
    );

    // --- REVISED Step 8: Assign Current/Potential Based on Validation & Combined Chevron Sample ---
    let currentBandInfo: EpcBandInfo | null = null;
    let potentialBandInfo: EpcBandInfo | null = null;

    // --- Heuristic Check for A/B Ambiguity ---
    const isOnlyAandBValidated =
      validatedBands.length === 2 &&
      validatedBands.some((b) => b.letter === "A") &&
      validatedBands.some((b) => b.letter === "B");

    if (isOnlyAandBValidated && sampledCombinedChevronColor) {
      // If only A & B are valid possibilities, and chevron sampling found *a* color,
      // strongly assume it must be B, overriding potentially misleading color distance.
      console.log(
        "[Canvas Process - Heuristic] Validated bands are A & B, and combined chevron color found. Forcing B/B."
      );
      const bandBInfo = EPC_BANDS.find((b) => b.letter === "B");
      if (bandBInfo) {
        currentBandInfo = bandBInfo;
        potentialBandInfo = bandBInfo;
      } else {
        // Should not happen, but fallback just in case
        console.warn("[Canvas Process - Heuristic] Could not find Band B info for override!");
        // Fallback to sorting A and B
        const sortedBands = validatedBands.sort((a, b) => b.score - a.score);
        potentialBandInfo = sortedBands[0];
        currentBandInfo = sortedBands[1];
      }
    }
    // --- Original Logic (if not the specific A/B case or if combined sample failed) ---
    else if (validatedBands.length >= 2) {
      // If we successfully sampled a dominant color from the combined chevron area
      if (sampledCombinedChevronColor) {
        console.log(
          "[Canvas Process - Combined Chevron Check] Found combined color. Determining single best match among validated bands."
        );
        let bestSingleMatch: EpcBandInfo | null = null;
        let minSingleDistance = Infinity;
        validatedBands.forEach((band) => {
          const targetColor = band.referenceColorRgb;
          if (targetColor) {
            const dist = Math.sqrt(
              Math.pow(sampledCombinedChevronColor.r - targetColor.r, 2) +
                Math.pow(sampledCombinedChevronColor.g - targetColor.g, 2) +
                Math.pow(sampledCombinedChevronColor.b - targetColor.b, 2)
            );
            // Check distance against the TIGHTER threshold
            if (dist < CHEVRON_COLOR_SIMILARITY_THRESHOLD && dist < minSingleDistance) {
              minSingleDistance = dist;
              bestSingleMatch = band;
            }
          }
        });

        if (bestSingleMatch) {
          const bestMatchInfo = bestSingleMatch as EpcBandInfo;
          console.log(
            `[Canvas Process - Combined Chevron Check] Best single match is ${bestMatchInfo.letter}. Assuming Current=Potential.`
          );
          currentBandInfo = bestMatchInfo;
          potentialBandInfo = bestMatchInfo;
        } else {
          console.warn(
            "[Canvas Process - Combined Chevron Check] Combined color didn't match validated bands well. Falling back to sorting."
          );
          const sortedBands = validatedBands.slice(0, 2).sort((a, b) => b.score - a.score);
          potentialBandInfo = sortedBands[0];
          currentBandInfo = sortedBands[1];
        }
      } else {
        console.warn(
          "[Canvas Process - Combined Chevron Check] Failed to sample combined color. Falling back to sorting."
        );
        const sortedBands = validatedBands.slice(0, 2).sort((a, b) => b.score - a.score);
        potentialBandInfo = sortedBands[0];
        currentBandInfo = sortedBands[1];
      }
    } else if (validatedBands.length === 1) {
      currentBandInfo = validatedBands[0];
      potentialBandInfo = validatedBands[0];
      console.warn(
        "[Canvas Process - VC] Only one *validated* band color found. Assuming Current and Potential are the same."
      );
    } else {
      console.error(
        "[Canvas Process - VC] Could not find two *validated* significant band colors."
      );
      return { error: "Could not identify distinct & validated current/potential bands." };
    }

    console.log(
      `[Canvas Process - Final] Final Result -> Current: ${currentBandInfo?.letter ?? "N/A"}, Potential: ${potentialBandInfo?.letter ?? "N/A"}`
    );

    // 9. Draw Debug Info (Updated)
    if (debugCanvas) {
      ctx.drawImage(img, 0, 0);
      // Draw DYNAMICALLY found reference regions (Magenta)
      ctx.strokeStyle = "rgba(255, 0, 255, 0.7)";
      ctx.lineWidth = 2;
      Object.values(dynamicBandRegions).forEach((region) => {
        if (region) {
          // Check if region was actually found
          ctx.strokeRect(
            region.x * canvas.width,
            region.y * canvas.height,
            region.width * canvas.width,
            region.height * canvas.height
          );
        }
      });
      // Draw NARROWER cyan region
      ctx.strokeStyle = "rgba(0, 255, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        rightAnalysisRegion.x * canvas.width,
        rightAnalysisRegion.y * canvas.height,
        rightAnalysisRegion.width * canvas.width,
        rightAnalysisRegion.height * canvas.height
      );
      // Draw text results
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(10, 10, 200, 50);
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`Current: ${currentBandInfo?.letter ?? "N/A"}`, 20, 30);
      ctx.fillText(`Potential: ${potentialBandInfo?.letter ?? "N/A"}`, 20, 50);
    }

    return {
      currentBand: currentBandInfo ?? undefined,
      potentialBand: potentialBandInfo ?? undefined,
    };
  } catch (error: any) {
    console.error("[Canvas Process - Error] Error processing EPC image:", error);
    return { error: error?.message || "Failed to process image" };
  }
};

export interface EpcBandResult {
  currentBand?: EpcBandInfo;
  potentialBand?: EpcBandInfo;
  error?: string;
}
