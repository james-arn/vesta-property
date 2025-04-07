export interface RGBColor {
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

export interface EpcBandResult {
  currentBand?: EpcBandInfo;
  potentialBand?: EpcBandInfo;
  error?: string;
}
