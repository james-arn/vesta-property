// Remove types from the node-canvas library imports if they exist
// import { Image, Canvas, CanvasRenderingContext2D as NodeCanvasRenderingContext2D } from 'canvas';
// Remove self-import
// import { EpcBandInfo, EpcBandResult } from './epcImageUtils';

// Import ActionEvents if not already imported

// Define interfaces for clarity
interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface EpcBandInfo {
  letter: string;
  range: { min: number; max: number | string }; // Max can be '92+' for A
  referenceColorHex: string;
  referenceColorRgb?: RGBColor; // Will be populated
  score: number; // <-- Add score property
}

// Standard EPC Band definitions
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

// Export EpcBandResult
export interface EpcBandResult {
  currentBand?: EpcBandInfo;
  potentialBand?: EpcBandInfo;
  error?: string;
}

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
const COLOR_SIMILARITY_THRESHOLD = 55; // Was 45
const MIN_ALPHA_THRESHOLD = 200; // Ignore mostly transparent pixels
const IGNORE_COLOR_THRESHOLD = 50; // How close to pure white/black/grey to ignore
const MIN_PIXEL_COUNT_THRESHOLD = 10; // Minimum number of pixels for a color to be considered significant on the right side

// --- Helper Functions (Required for new logic) ---

// Function to check if two RGB colors are similar (Euclidean distance)
const areColorsSimilar = (color1: RGBColor, color2: RGBColor): boolean => {
  // Check if colors are valid before calculating distance
  if (!color1 || !color2) return false;
  const dist = Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
  return dist < COLOR_SIMILARITY_THRESHOLD;
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
  const foundRegions: Record<string, RelativeRegion> = {};
  const bandHeights: Record<string, number> = {}; // Store heights to calculate y positions
  const bandYs: Record<string, number> = {}; // Store top y positions

  // --- Revert scan line position but keep other relaxed parameters ---
  const scanX = Math.floor(canvasWidth * 0.15); // Scan vertically around 15% from left (back from 25%)
  const scanWidth = Math.max(1, Math.floor(canvasWidth * 0.1)); // Keep wider (10%) horizontal line
  const stepY = 1; // Scan every pixel vertically
  const minColorStreak = 3; // Keep shorter streak (3)

  console.log(`[Dynamic Region Finder] Starting scan at x=${scanX}`);

  let lastY = 0;
  for (const band of EPC_BANDS) {
    // Iterate in order (A to G)
    const targetColor = band.referenceColorRgb;
    if (!targetColor) continue; // Skip if reference color missing

    let currentStreak = 0;
    let streakStartY = -1;

    // Scan vertically downwards from the last found position
    // Start scan slightly below the last band found to avoid overlap issues
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
        // Was / 2 (require > 1/3 match, not > 1/2)
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
            `[Dynamic Region Finder] Found streak for Band ${band.letter} at y=${bandTopY} to y=${bandBottomY} (Height: ${detectedHeight}px)`
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
        `[Dynamic Region Finder] Found streak for Band ${band.letter} at end of scan y=${bandTopY} to y=${bandBottomY} (Height: ${detectedHeight}px)`
      );
      if (detectedHeight > 0) {
        bandYs[band.letter] = bandTopY / canvasHeight;
        bandHeights[band.letter] = detectedHeight / canvasHeight;
        lastY = bandBottomY;
      }
    }
  }

  // Construct RelativeRegions using found Y and Height
  Object.keys(bandYs).forEach((letter) => {
    if (bandHeights[letter]) {
      foundRegions[letter] = {
        x: 0.05, // Keep standard left-side position
        y: bandYs[letter], // Use dynamically found Y
        width: 0.25, // Standard width
        height: bandHeights[letter], // Use dynamically found Height
      };
    }
  });

  const foundCount = Object.keys(foundRegions).length;
  console.log(`[Dynamic Region Finder] Found ${foundCount} band regions dynamically.`);

  // Require at least a few bands to be found for confidence
  if (foundCount < 3) {
    console.error("[Dynamic Region Finder] Failed to find enough band regions dynamically.");
    return null;
  }

  return foundRegions;
};

// --- Main Processing Function (Uses Dynamic Regions + Vertical Check) ---
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

    // 5. Match Right-Side Pixels to ACTUAL Reference Colors and Store Matches with Y coords
    interface BandMatchData {
      count: number;
      ySum: number;
    }
    const bandMatches: Record<string, BandMatchData> = {};

    rightSidePixelsData.forEach((pixelData) => {
      let closestMatch: { color: RGBColor; bandInfo: EpcBandInfo } | null = null;
      let minDistance = COLOR_SIMILARITY_THRESHOLD;

      actualReferenceColors.forEach((ref) => {
        const dist = Math.sqrt(
          Math.pow(pixelData.color.r - ref.color.r, 2) +
            Math.pow(pixelData.color.g - ref.color.g, 2) +
            Math.pow(pixelData.color.b - ref.color.b, 2)
        );
        if (dist < minDistance) {
          minDistance = dist;
          closestMatch = ref;
        }
      });

      if (closestMatch) {
        const matchData = closestMatch as { color: RGBColor; bandInfo: EpcBandInfo };
        const bandKey = matchData.bandInfo.letter;
        if (!bandMatches[bandKey]) {
          bandMatches[bandKey] = { count: 0, ySum: 0 };
        }
        bandMatches[bandKey].count++;
        bandMatches[bandKey].ySum += pixelData.y; // Add Y coordinate
      }
    });

    console.log("[Canvas Process - VC] Match data (count, ySum) on right side:", bandMatches);

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

    // 8. Assign Current/Potential Based on Validated Bands and Rank
    let currentBandInfo: EpcBandInfo | null = null;
    let potentialBandInfo: EpcBandInfo | null = null;
    if (validatedBands.length >= 2) {
      const sortedBands = validatedBands.slice(0, 2).sort((a, b) => b.score - a.score);
      potentialBandInfo = sortedBands[0];
      currentBandInfo = sortedBands[1];
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
      // Fallback or different error? Maybe return the pre-validation result?
      // For now, return error
      return { error: "Could not identify distinct & validated current/potential bands." };
    }

    console.log(
      `[Canvas Process - VC] Final Result -> Current: ${currentBandInfo?.letter ?? "N/A"}, Potential: ${potentialBandInfo?.letter ?? "N/A"}`
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
    console.error("[Canvas Process - VC] Error processing EPC image:", error);
    return { error: error?.message || "Failed to process image" };
  }
};

export interface EpcBandResult {
  currentBand?: EpcBandInfo;
  potentialBand?: EpcBandInfo;
  error?: string;
}
