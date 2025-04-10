// Define enum for categories for type safety and mapping
export enum DashboardScoreCategory {
  RUNNING_COSTS = "RUNNING_COSTS",
  SAFETY = "SAFETY",
  CONDITION = "CONDITION",
  VALUE_FOR_MONEY = "VALUE_FOR_MONEY",
  RISK = "RISK",
  COMPLETENESS = "COMPLETENESS",
}

// Map categories to the *keys* of checklist items contributing to them
// **CRUCIAL**: Update these keys to match your actual PropertyDataList keys
export const CATEGORY_ITEM_MAP: { [key in DashboardScoreCategory]?: string[] } = {
  [DashboardScoreCategory.RUNNING_COSTS]: ["councilTax", "epc", "heatingType", "windows", "tenure"],
  [DashboardScoreCategory.SAFETY]: [
    "crimeScore",
    "floodDefences",
    "floodSources",
    "floodedInLastFiveYears",
    "buildingSafety",
    "coastalErosion",
    "miningImpact",
  ],
  [DashboardScoreCategory.CONDITION]: [
    "propertyType",
    "bedrooms",
    "bathrooms",
    "size",
    "heatingType",
    "windows",
    "epc",
  ], // Example keys (EPC contributes here too)
  [DashboardScoreCategory.VALUE_FOR_MONEY]: [
    "salePrice",
    "priceDiscrepancy",
    "compoundAnnualGrowthRate",
    "volatility",
  ], // Example keys from salesHistory
  [DashboardScoreCategory.RISK]: [
    "tenure",
    "listedProperty",
    "restrictions",
    "publicRightOfWayObligation",
    "privateRightOfWayObligation",
  ], // Example keys
  // Completeness is calculated globally
};

// User-friendly display names for categories
export const DASHBOARD_CATEGORY_DISPLAY_NAMES: Record<DashboardScoreCategory, string> = {
  [DashboardScoreCategory.RUNNING_COSTS]: "Running Costs",
  [DashboardScoreCategory.SAFETY]: "Safety & Environment",
  [DashboardScoreCategory.CONDITION]: "Property Condition",
  [DashboardScoreCategory.VALUE_FOR_MONEY]: "Value For Money",
  [DashboardScoreCategory.RISK]: "Legal & Risk Factors",
  [DashboardScoreCategory.COMPLETENESS]: "Listing Completeness",
};
