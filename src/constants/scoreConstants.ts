export const BASE_SCORE = 50;
export const MAX_SCORE = 100;

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
  COUNCIL_TAX: 0.3,
  EPC: 0.5,
  TENURE: 0.2,
};

// Tenure Cost Scores (Used in Running Costs)
export const TENURE_COST_SCORES = {
  LEASEHOLD: 60, // Higher cost score for leasehold
  UNKNOWN: 30, // Moderate cost score for unknown/check manually
  OTHER: 0, // Low cost score for freehold/other positive identifications
};

// Connectivity Scores
export const FOUND_STATIONS_SCORE = 80;
export const NO_STATIONS_SCORE = 30;
