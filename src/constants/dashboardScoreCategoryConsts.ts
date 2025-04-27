// Define enum for categories for type safety and mapping
export enum DashboardScoreCategory {
  RUNNING_COSTS = "RUNNING_COSTS",
  INVESTMENT_VALUE = "INVESTMENT_VALUE",
  CONNECTIVITY = "CONNECTIVITY",
  CONDITION = "CONDITION",
  ENVIRONMENT_RISK = "ENVIRONMENTAL_RISK",
  LEGAL_CONSTRAINTS = "LEGAL_CONSTRAINTS",
  LISTING_COMPLETENESS = "LISTING_COMPLETENESS",
}

// Map categories to the *keys* of checklist items contributing to them
// **CRUCIAL**: Update these keys to match your actual PropertyDataList keys
export const CATEGORY_ITEM_MAP: { [key in DashboardScoreCategory]?: string[] } = {
  [DashboardScoreCategory.RUNNING_COSTS]: [
    "councilTax",
    "epc", // Efficiency impacts cost
    "heatingType", // Fuel type/efficiency impacts cost
    "windows", // Glazing impacts heating cost
    "tenure", // Leasehold vs freehold - leasehold may have
    "groundRent", // Direct cost for leaseholders
    "serviceCharge", // Direct cost for leaseholders/managed properties
    // Consider adding broadband/mobile coverage if they have cost implications?
  ],
  [DashboardScoreCategory.INVESTMENT_VALUE]: [
    "price", // Asking price
    "askingVsEstimateComparison", // Asking price vs estimate
    "listingHistory", // Price changes, time on market
    "compoundAnnualGrowthRate", // Historical growth
    "volatility", // Price stability
    "estimatedSaleValue", // AVM benchmark
    "nearbyCompletedSales", // Comparables
    "outcodeAvgSalesPrice", // Area benchmark
    "outcodePriceTrend", // Market direction
    "outcodePriceTrend12mAvg",
    "estimatedRentalValue", // For BTL
    "estimatedAnnualRentalYield", // For BTL
    "yearlySalesVolume",
    "propensityToSell",
    "propensityToLet",
    "nearbySalesListings",
    "nearbyRentalListings",
    "marketTurnoverRate",
  ],
  [DashboardScoreCategory.CONNECTIVITY]: [
    "broadband",
    "mobileServiceCoverage",
    "healthcareProximity",
    "schoolProximity",
    "nearestStations",
    "policeForceProximity",
    // premium has ferry?
  ],
  [DashboardScoreCategory.CONDITION]: [
    "propertyType",
    "epc", // Reflects insulation, system age
    "heatingType", // System age/type
    "constructionMaterials", // Maintenance implications
    "constructionAgeBand", // Age implies condition
    "windows", // Glazing/material state
    "buildingSafety", // Keywords might indicate condition issues (e.g., mould)
    "occupancyStatus", // Potential wear difference
  ],
  [DashboardScoreCategory.ENVIRONMENT_RISK]: [
    "crimeScore",
    "floodDefences",
    "floodSources",
    "floodedInLastFiveYears",
    "detailedFloodRiskAssessment",
    "coastalErosion",
    "miningImpact",
    "airportNoiseAssessment",
    "nationalParkProximity",
    "conservationArea",
  ],
  [DashboardScoreCategory.LEGAL_CONSTRAINTS]: [
    "tenure",
    "listedProperty",
    "restrictiveCovenants",
    "publicRightOfWayObligation",
    "privateRightOfWayObligation",
    "leaseTerm",
    "planningPermissions",
    "nearbyPlanningPermissions",
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
  [DashboardScoreCategory.LISTING_COMPLETENESS]: "Listing Completeness",
};

export const CALCULATED_STATUS = {
  CALCULATED: "CALCULATED",
  UNCALCULATED_MISSING_DATA: "UNCALCULATED_MISSING_DATA",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;

export const DISABLED_BAR_BACKGROUND =
  "repeating-linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted)) 4px, hsl(var(--muted-foreground)/0.5) 4px, hsl(var(--muted-foreground)/0.5) 8px)";
