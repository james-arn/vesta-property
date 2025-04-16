// Define enum for categories for type safety and mapping
export enum DashboardScoreCategory {
  RUNNING_COSTS = "RUNNING_COSTS",
  INVESTMENT_VALUE = "INVESTMENT_VALUE",
  CONNECTIVITY = "CONNECTIVITY",
  CONDITION = "CONDITION",
  ENVIRONMENTAL_RISK = "ENVIRONMENTAL_RISK",
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
  [DashboardScoreCategory.ENVIRONMENTAL_RISK]: [
    "crimeScore",
    "floodDefences",
    "floodSources",
    "floodedInLastFiveYears",
    "detailedFloodRiskAssessment",
    "buildingSafety", // Environmental hazards (e.g., asbestos)
    "coastalErosion",
    "miningImpact",
    "airportNoiseAssessment",
    "nationalParkProximity",
    "policeForceProximity",
    "healthcareProximity",
  ],
  [DashboardScoreCategory.LEGAL_CONSTRAINTS]: [
    "tenure",
    "listedProperty",
    "restrictions",
    "publicRightOfWayObligation",
    "privateRightOfWayObligation",
    "remainingLeaseTerm",
    "titleDeedIssues",
    "conservationAreaStatus",
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
  [DashboardScoreCategory.ENVIRONMENTAL_RISK]: "Environmental Risk",
  [DashboardScoreCategory.LEGAL_CONSTRAINTS]: "Legal Constraints",
  [DashboardScoreCategory.LISTING_COMPLETENESS]: "Listing Completeness",
};
