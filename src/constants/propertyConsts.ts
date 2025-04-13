import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts"; // Corrected import path

export const PropertyGroups = {
  GENERAL: "General",
  INVESTMENT_POTENTIAL: "Investment Potential",
  INTERIOR: "Interior",
  EXTERIOR: "Exterior",
  UTILITIES: "Utilities",
  NEIGHBOURHOOD: "Neighbourhood",
  LEGAL: "Legal",
  RENTING: "Renting",
  RISKS: "Risks",
  MISC: "Miscellaneous",
  RIGHTS_AND_RESTRICTIONS: "Rights and Restrictions",
  PREMIUM: "Premium",
} as const;

export const PREMIUM_DATA_STATES = {
  FETCHING: "Fetching premium data...",
  NO_APPLICATIONS: "No applications found",
  NO_NEARBY_APPLICATIONS: "No nearby applications found",
  ERROR: "Error fetching data",
  NOT_FOUND: CHECKLIST_NO_VALUE.NOT_FOUND,
} as const;

export type PremiumDataStateValue = (typeof PREMIUM_DATA_STATES)[keyof typeof PREMIUM_DATA_STATES];

export const isPremiumNoDataValue = (value: unknown): value is PremiumDataStateValue => {
  return (
    typeof value === "string" &&
    (Object.values(PREMIUM_DATA_STATES) as readonly string[]).includes(value)
  );
};

export const PREMIUM_LOCKED_DESCRIPTIONS: Record<string, string> = {
  planningPermissions: "Unlock details on applications and restrictions [Premium]",
  nearbyPlanningPermissions: "See what's happening in your area [Premium]",
  floodRisk: "See detailed risk assessment and history [Premium]",
  schoolsNearby: "Find top-rated educational institutions nearby [Premium]",
};

export const PriceDiscrepancyReason = {
  NO_PREVIOUS_SOLD_HISTORY: "noPreviousSoldHistory",
  MISSING_OR_INVALID_PRICE_DATA: "missingOrInvalidPriceData",
  PRICE_GAP_WITHIN_EXPECTED_RANGE: "priceGapWithinExpectedRange",
  PRICE_GAP_EXCEEDS_EXPECTED_RANGE: "priceGapExceedsExpectedRange",
  PRICE_DROP: "priceDrop",
} as const;

export const NOT_APPLICABLE = "N/A";
