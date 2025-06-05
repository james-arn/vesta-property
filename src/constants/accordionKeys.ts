export const ACCORDION_IDS = {
  MOBILE_COVERAGE: "mobileCoverage",
  COASTAL_EROSION: "coastalErosion",
  FLOOD_RISK: "floodRisk",
  CRIME: "crime",
  PLANNING_PERMISSION: "planningPermission",
  NEARBY_PLANNING_PERMISSION: "nearbyPlanningPermission",
} as const;

export type AccordionId = (typeof ACCORDION_IDS)[keyof typeof ACCORDION_IDS];

export const ALL_ACCORDION_IDS: AccordionId[] = Object.values(ACCORDION_IDS);
