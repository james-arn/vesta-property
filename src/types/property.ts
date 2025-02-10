export enum DataStatus {
  FOUND_POSITIVE = "FOUND_POSITIVE",
  FOUND_NEGATIVE = "FOUND_NEGATIVE",
  ASK_AGENT = "ASK_AGENT",
}

export interface PropertyDataList {
  label: string;
  status: DataStatus;
  value: string | null;
  key: string;
  group: string;
  selected?: boolean;
  askAgentMessage: string;
  toolTipExplainer: string;
}

export interface AgentDetails {
  name: string;
  contactUrl: string;
  phoneNumber: string | null;
}

interface TermResult {
  value: string | null;
  status: DataStatus | null;
  reason: string | null;
}

export interface ExtractedPropertyData {
  accessibility: string | null;
  agent: AgentDetails | null;
  bathrooms: string | null;
  bedrooms: string | null;
  broadband: string | null;
  buildingSafety: TermResult;
  coastalErosion: TermResult;
  copyLinkUrl: string | null;
  councilTax: string | null;
  epc: string | null;
  floodedInLastFiveYears: boolean | null;
  floodDefences: boolean | null;
  floodSources: string[] | null;
  floorPlan: string | null;
  garden: string | null;
  heating: string | null;
  isRental: boolean;
  listedProperty: boolean | null;
  listingHistory: string | null;
  location: string | null;
  miningImpact: TermResult;
  parking: string | null;
  privateRightOfWayObligation: boolean | null;
  propertyType: string | null;
  publicRightOfWayObligation: boolean | null;
  restrictions: boolean | null;
  salePrice: string | null;
  salesHistory: {
    priceDiscrepancy: TermResult;
    compoundAnnualGrowthRate: number | null;
    volatility: string | null;
  };
  size: string | null;
  tenure: string | null;
  windows: string | null;
}

export interface SaleHistoryEntry {
  year: string;
  soldPrice: string;
  percentageChange: string;
}

export const PropertyGroups = {
  GENERAL: "General",
  SALES_HISTORY: "Sales History",
  INTERIOR: "Interior",
  EXTERIOR: "Exterior",
  UTILITIES: "Utilities",
  NEIGHBOURHOOD: "Neighbourhood",
  LEGAL: "Legal",
  RENTING: "Renting",
  RISKS: "Risks",
  MISC: "Miscellaneous",
  RIGHTS_AND_RESTRICTIONS: "Rights and Restrictions",
} as const;

export const PriceDiscrepancyReason = {
  NO_PREVIOUS_SOLD_HISTORY: "noPreviousSoldHistory",
  MISSING_OR_INVALID_PRICE_DATA: "missingOrInvalidPriceData",
  PRICE_GAP_WITHIN_EXPECTED_RANGE: "priceGapWithinExpectedRange",
  PRICE_GAP_EXCEEDS_EXPECTED_RANGE: "priceGapExceedsExpectedRange",
  PRICE_DROP: "priceDrop",
} as const;

export const NOT_APPLICABLE = "N/A";
