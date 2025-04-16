import { CrimeRating } from "@/hooks/useCrimeScore";

export const BASE_SCORE = 50;
export const MAX_SCORE = 100;
export const MIN_EPC_SCORE = 1;
export const MAX_EPC_SCORE = 100;

// Investment Score Thresholds
export const LOW_CAGR_THRESHOLD = 0.03; // 3%
export const HIGH_CAGR_THRESHOLD = 0.06; // 6%
export const LOW_RENTAL_YIELD_THRESHOLD = 0.04; // 4%
export const HIGH_RENTAL_YIELD_THRESHOLD = 0.06; // 6%
export const VOLATILITY_THRESHOLD = 0.1; // 10%
export const HIGH_PROPENSITY_SELL_THRESHOLD = 0.7; // 70%
export const HIGH_PROPENSITY_LET_THRESHOLD = 0.2; // 20%

// Investment Score Weights
export const LOW_GROWTH_PENALTY = -10;
export const HIGH_GROWTH_BONUS = 10;
export const MAX_VALUE_BONUS = 15; // Max points for undervalued
export const MAX_VALUE_PENALTY = -15; // Max points penalty for overvalued
export const VALUE_MODIFIER_SENSITIVITY_THRESHOLD = 0.3; // Full bonus/penalty at 30% diff
export const FALLBACK_VALUE_MODIFIER_FACTOR = 0.5; // Reduce impact when using fallback avg
export const HIGH_RENTAL_YIELD_BONUS = 15;
export const LOW_RENTAL_YIELD_PENALTY = -10;
export const LOW_TURNOVER_THRESHOLD = 0.03; // Added (3%)
export const HIGH_TURNOVER_THRESHOLD = 0.06; // Added (6%)
export const LOW_TURNOVER_PENALTY = -5; // Added
export const HIGH_TURNOVER_BONUS = 5; // Added
export const HIGH_PROPENSITY_SELL_BONUS = 3;
export const HIGH_PROPENSITY_LET_BONUS = 2;
export const HIGH_VOLATILITY_PENALTY = -5;

// Running Costs Weights
export const RUNNING_COSTS_WEIGHTS = {
  COUNCIL_TAX: 0.4,
  EPC: 0.4,
  SERVICE_CHARGE: 0.15,
  GROUND_RENT: 0.05,
  TENURE: 0.05,
};

// Tenure Cost Scores (Base cost/risk for leasehold, now less impactful)
export const TENURE_COST_SCORES = {
  LEASEHOLD: 20, // Base cost/risk associated with leasehold not covered by GR/SC
  OTHER: 0, // Freehold, Share of Freehold etc.
  UNKNOWN: 10, // Average uncertainty score
};

// Thresholds and Scores for Ground Rent (Annual)
export const GROUND_RENT_THRESHOLDS = {
  LOW: 100,
  MEDIUM: 250,
};
export const GROUND_RENT_COST_SCORES = {
  PEPPERCORN: 0, // Explicitly 'peppercorn' £0
  LOW: 10, // £1 - £100 (up to LOW threshold)
  MEDIUM: 40, // £101 - £250 (between LOW and MEDIUM thresholds)
  HIGH: 80, // > £250 (above MEDIUM threshold)
  UNKNOWN: 30, // Default if value missing/unparseable
};

// Thresholds and Scores for Service Charge (Annual)
export const SERVICE_CHARGE_THRESHOLDS = {
  LOW: 1000,
  MEDIUM: 2500,
};
export const SERVICE_CHARGE_COST_SCORES = {
  LOW: 15, // < £1000
  MEDIUM: 50, // £1000 - £2500
  HIGH: 90, // > £2500
  UNKNOWN: 40, // Default if value missing/unparseable
};

// Connectivity Scores
export const FOUND_STATIONS_SCORE = 80;
export const NO_STATIONS_SCORE = 30;
export const MAX_SCHOOL_DISTANCE_MILES = 3; // Schools beyond this distance have minimal impact
export const SCHOOL_DISTANCE_WEIGHT_FACTOR = 0.7; // How much distance affects score (lower = less effect)
export const OFSTED_RATINGS_SCORES: { [key: string]: number } = {
  outstanding: 100,
  good: 75,
  "requires improvement": 40,
  inadequate: 20,
};

export const UK_AVERAGE_BROADBAND_MBPS = 75;

export const BUILDING_SAFETY_SEVERE_NEGATIVE_TERMS = ["mould", "damp", "asbestos", "radon"];
export const BUILDING_SAFETY_POSITIVE_MODIFIER = 0.5;
export const BUILDING_SAFETY_NEGATIVE_MODIFIER = -1;
export const BUILDING_SAFETY_SEVERE_NEGATIVE_MODIFIER = -5;

export const ENVIRONMENT_RISK_FACTOR_WEIGHTS: Record<string, number> = {
  crimeScore: 18,
  floodRisk: 27,
  buildingSafety: 14,
  coastalErosion: 14,
  miningImpact: 9,
  airportNoiseAssessment: 9,
  conservationArea: 9,
};

export const CRIME_RATINGS: Record<Uppercase<CrimeRating>, CrimeRating> = {
  HIGH: "High",
  MODERATE: "Moderate",
  LOW: "Low",
} as const;

// Map ratings to score multipliers using the typed constants
export const CRIME_RATING_MULTIPLIERS: Record<CrimeRating, number> = {
  High: 1.0,
  Moderate: 0.6,
  Low: 0.1,
};

// Numerical thresholds as fallback (align with ratings)
export const CRIME_SCORE_THRESHOLDS = {
  high: 7, // Corresponds to High rating boundary
  medium: 4, // Corresponds to Moderate rating boundary
};

// Maps AirportNoise categories to risk multipliers (0 = none, 1 = max risk)
export const AIRPORT_NOISE_CATEGORY_MULTIPLIERS: Record<string, number> = {
  None: 0.0,
  Minimal: 0.1,
  Occasional: 0.25,
  Regular: 0.4,
  Frequent: 0.6,
  High: 0.8,
  "Very High": 0.95, // Using string literal for key with space
  "Extremely High": 1.0, // Using string literal for key with space
};

// Maps FloodRisk levels to risk multipliers (0 = very low, 1 = very high)
// Applied to the 'assessment' portion of the flood risk score.
export const FLOOD_RISK_LEVEL_MULTIPLIERS: Record<string, number> = {
  "very high": 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.2,
  "very low": 0.0,
};
