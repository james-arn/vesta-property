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

export interface ExtractedPropertyData {
  copyLinkUrl: string | null;
  salePrice: string | null;
  location: string | null;
  propertyType: string | null;
  tenure: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  councilTax: string | null;
  size: string | null;
  parking: string | null;
  heating: string | null;
  floorPlan: string | null;
  garden: string | null;
  epc: string | null;
  broadband: string | null;
  listingHistory: string | null;
  windows: string | null;
  publicRightOfWayObligation: boolean | null;
  privateRightOfWayObligation: boolean | null;
  listedProperty: boolean | null;
  restrictions: boolean | null;
  floodDefences: boolean | null;
  floodSources: string[] | null;
  floodedInLastFiveYears: boolean | null;
  accessibility: string | null;
  agent: AgentDetails | null;
  salesHistory: {
    priceDiscrepancy: {
      value: string | null;
      status: DataStatus | null;
      reason: string | null;
    };
    compoundAnnualGrowthRate: number | null;
    volatility: string | null;
  };
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
