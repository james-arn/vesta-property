export const FLOOD_RISK_LABELS = {
  HIGH_RISK: "High Risk",
  MEDIUM_RISK: "Medium Risk",
  LOW_RISK: "Low Risk",
  VERY_LOW_RISK: "Very Low Risk",
  ASSESSMENT_AVAILABLE_NO_SPECIFIC_LEVELS: "Assessment Data Available (No Specific Levels)",
  ASSESSMENT_AVAILABLE_UNQUANTIFIED: "Assessment data available, specific risk unquantified",
  RISK_LEVEL_ASSESSED: "Risk Level Assessed", // General fallback when specific levels are processed but no high/medium/low determined
  PREMIUM_ASSESSMENT_AVAILABLE: "Premium Assessment Available", // Used when premium structure exists but no specific label otherwise
  BASIC_INFO_AVAILABLE: "Basic Info Available", // Used when only basic, non-scorable listing data found
} as const;
