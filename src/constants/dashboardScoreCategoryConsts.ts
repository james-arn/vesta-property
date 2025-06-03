import { CHECKLIST_KEYS } from "./checklistKeys";

// Define enum for categories for type safety and mapping
export enum DashboardScoreCategory {
  RUNNING_COSTS = "RUNNING_COSTS",
  INVESTMENT_VALUE = "INVESTMENT_VALUE",
  CONNECTIVITY = "CONNECTIVITY",
  CONDITION = "CONDITION",
  ENVIRONMENT_RISK = "ENVIRONMENTAL_RISK",
  LEGAL_CONSTRAINTS = "LEGAL_CONSTRAINTS",
  DATA_COVERAGE = "DATA_COVERAGE",
}

// Map categories to the *keys* of checklist items contributing to them
// **CRUCIAL**: Update these keys to match your actual PropertyDataList keys
export const CATEGORY_ITEM_MAP: { [key in DashboardScoreCategory]?: string[] } = {
  [DashboardScoreCategory.RUNNING_COSTS]: [
    CHECKLIST_KEYS.COUNCIL_TAX,
    CHECKLIST_KEYS.EPC, // Efficiency impacts cost
    CHECKLIST_KEYS.HEATING_TYPE, // Fuel type/efficiency impacts cost
    CHECKLIST_KEYS.WINDOWS, // Glazing impacts heating cost
    CHECKLIST_KEYS.TENURE, // Leasehold vs freehold - leasehold may have
    CHECKLIST_KEYS.GROUND_RENT, // Direct cost for leaseholders
    CHECKLIST_KEYS.SERVICE_CHARGE, // Direct cost for leaseholders/managed properties
    // Consider adding broadband/mobile coverage if they have cost implications?
  ],
  [DashboardScoreCategory.INVESTMENT_VALUE]: [
    CHECKLIST_KEYS.PRICE, // Asking price
    CHECKLIST_KEYS.ASKING_VS_ESTIMATE_COMPARISON, // Asking price vs estimate
    CHECKLIST_KEYS.PRICE_DISCREPANCY,
    CHECKLIST_KEYS.LISTING_HISTORY, // Price changes, time on market
    CHECKLIST_KEYS.COMPOUND_ANNUAL_GROWTH_RATE, // Historical growth
    CHECKLIST_KEYS.VOLATILITY, // Price stability
    CHECKLIST_KEYS.ESTIMATED_SALE_VALUE, // AVM benchmark
    CHECKLIST_KEYS.OUTCODE_AVG_SALES_PRICE, // Area benchmark
    CHECKLIST_KEYS.ESTIMATED_RENTAL_VALUE, // For BTL
    CHECKLIST_KEYS.ESTIMATED_ANNUAL_RENTAL_YIELD, // For BTL
    CHECKLIST_KEYS.PROPENSITY_TO_SELL,
    CHECKLIST_KEYS.PROPENSITY_TO_LET,
    CHECKLIST_KEYS.MARKET_TURNOVER_RATE,
  ],
  [DashboardScoreCategory.CONNECTIVITY]: [
    CHECKLIST_KEYS.BROADBAND,
    CHECKLIST_KEYS.NEAREST_STATIONS,
    CHECKLIST_KEYS.POLICE_FORCE_PROXIMITY,
    CHECKLIST_KEYS.MOBILE_COVERAGE,
  ],
  [DashboardScoreCategory.CONDITION]: [
    CHECKLIST_KEYS.PROPERTY_TYPE,
    CHECKLIST_KEYS.EPC, // Reflects insulation, system age
    CHECKLIST_KEYS.HEATING_TYPE, // System age/type
    CHECKLIST_KEYS.CONSTRUCTION_MATERIALS, // Maintenance implications
    CHECKLIST_KEYS.CONSTRUCTION_AGE_BAND, // Age implies condition
    CHECKLIST_KEYS.WINDOWS, // Glazing/material state
    CHECKLIST_KEYS.OCCUPANCY_STATUS, // Potential wear difference
  ],
  [DashboardScoreCategory.ENVIRONMENT_RISK]: [
    CHECKLIST_KEYS.CRIME_SCORE,
    CHECKLIST_KEYS.FLOOD_RISK,
    CHECKLIST_KEYS.COASTAL_EROSION,
    CHECKLIST_KEYS.AIRPORT_NOISE_ASSESSMENT,
  ],
  [DashboardScoreCategory.LEGAL_CONSTRAINTS]: [
    CHECKLIST_KEYS.TENURE,
    CHECKLIST_KEYS.LISTED_PROPERTY,
    CHECKLIST_KEYS.RESTRICTIVE_COVENANTS,
    CHECKLIST_KEYS.PUBLIC_RIGHT_OF_WAY,
    CHECKLIST_KEYS.PRIVATE_RIGHT_OF_WAY,
    CHECKLIST_KEYS.LEASE_TERM,
    CHECKLIST_KEYS.PLANNING_PERMISSIONS,
    CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS,
  ],
  // LISTING_COMPLETENESS uses a global calculation, no specific keys needed here
};

// User-friendly display names for categories
export const DASHBOARD_CATEGORY_DISPLAY_NAMES: Record<DashboardScoreCategory, string> = {
  [DashboardScoreCategory.RUNNING_COSTS]: "Running Costs",
  [DashboardScoreCategory.INVESTMENT_VALUE]: "Investment Value",
  [DashboardScoreCategory.CONNECTIVITY]: "Connectivity",
  [DashboardScoreCategory.CONDITION]: "Condition",
  [DashboardScoreCategory.ENVIRONMENT_RISK]: "Environment Risk",
  [DashboardScoreCategory.LEGAL_CONSTRAINTS]: "Legal Constraints",
  [DashboardScoreCategory.DATA_COVERAGE]: "Listing Completeness",
};

export const CALCULATED_STATUS = {
  CALCULATED: "CALCULATED",
  UNCALCULATED_MISSING_DATA: "UNCALCULATED_MISSING_DATA",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;

export const DISABLED_BAR_BACKGROUND =
  "repeating-linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted)) 4px, hsl(var(--muted-foreground)/0.5) 4px, hsl(var(--muted-foreground)/0.5) 8px)";
