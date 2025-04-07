import { EpcBandInfo } from "@/types/epc"; // Assuming type location

export const formatEPCBandInfo = (band: EpcBandInfo | undefined | null): string => {
  if (!band) return "N/A";
  // Ensure max is treated as string if necessary, although EPC types likely handle this.
  const rangeMax = typeof band.range.max === "string" ? band.range.max : String(band.range.max);
  return `${band.letter} (${band.range.min}-${rangeMax})`;
};
