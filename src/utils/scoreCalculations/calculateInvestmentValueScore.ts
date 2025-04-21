import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import {
  CATEGORY_ITEM_MAP,
  DashboardScoreCategory,
} from "@/constants/dashboardScoreCategoryConsts";
import {
  BASE_SCORE,
  FALLBACK_VALUE_MODIFIER_FACTOR,
  HIGH_CAGR_THRESHOLD,
  HIGH_GROWTH_BONUS,
  HIGH_PROPENSITY_LET_BONUS,
  HIGH_PROPENSITY_LET_THRESHOLD,
  HIGH_PROPENSITY_SELL_BONUS,
  HIGH_PROPENSITY_SELL_THRESHOLD,
  HIGH_RENTAL_YIELD_BONUS,
  HIGH_RENTAL_YIELD_THRESHOLD,
  HIGH_TURNOVER_BONUS,
  HIGH_TURNOVER_THRESHOLD,
  HIGH_VOLATILITY_PENALTY,
  LONG_LISTING_DURATION_THRESHOLD_DAYS,
  LONG_LISTING_PENALTY,
  LOW_CAGR_THRESHOLD,
  LOW_GROWTH_PENALTY,
  LOW_RENTAL_YIELD_PENALTY,
  LOW_RENTAL_YIELD_THRESHOLD,
  LOW_TURNOVER_PENALTY,
  LOW_TURNOVER_THRESHOLD,
  MAX_SCORE,
  MAX_VALUE_BONUS,
  MAX_VALUE_PENALTY,
  REDUCED_PRICE_PENALTY,
  VALUE_MODIFIER_SENSITIVITY_THRESHOLD,
  VOLATILITY_THRESHOLD,
} from "@/constants/scoreConstants";
import {
  CategoryScoreData,
  DataStatus,
  PreprocessedData,
  PropertyDataListItem,
} from "@/types/property";
import { findItemByKey, parseCurrency, parsePercentage } from "@/utils/parsingHelpers";

/**
 * Calculates an investment value score based on property checklist items and preprocessed data.
 * Considers growth, value comparison, rental yield, market activity, and volatility.
 * Handles missing data and uses preprocessed data (especially premium data) where available.
 */
export const calculateInvestmentValueScore = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData
): CategoryScoreData | undefined => {
  const contributingFactorKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.INVESTMENT_VALUE] || [];
  const contributingItems = items.filter((item) =>
    (contributingFactorKeys as string[]).includes(item.key)
  );

  const scoreModifiers: number[] = [];

  // --- Extract data from PreprocessedData ---
  const premiumData = preprocessedData.processedPremiumData;
  const outcodeTurnoverRate = premiumData?.outcodeTurnoverRate;
  const estSaleValueFromPremium = premiumData?.estimatedSaleValue;
  const estYieldFromPremium = premiumData?.estimatedAnnualRentalYield;
  const propensitySellFromPremium = premiumData?.propensityToSell;
  const propensityLetFromPremium = premiumData?.propensityToLet;
  const outcodeAvgPriceFromPremium = premiumData?.outcodeAvgSalesPrice;
  const listingDaysOnMarket = preprocessedData.listingDaysOnMarket;
  const listingHistoryStatus = preprocessedData.listingHistoryStatus;

  // --- Get Values from Checklist Items (can be overridden by premium data later if needed) ---
  const askingPriceItem = findItemByKey(items, CHECKLIST_KEYS.PRICE);
  const askingPriceValue =
    typeof askingPriceItem?.value === "string" || typeof askingPriceItem?.value === "number"
      ? askingPriceItem.value
      : null;
  const askingPrice = parseCurrency(askingPriceValue);

  const cagrItem = findItemByKey(items, CHECKLIST_KEYS.COMPOUND_ANNUAL_GROWTH_RATE);
  const cagrValue =
    typeof cagrItem?.value === "string" || typeof cagrItem?.value === "number"
      ? cagrItem.value
      : null;
  const cagr = parsePercentage(cagrValue);

  const volatilityItem = findItemByKey(items, CHECKLIST_KEYS.VOLATILITY);
  const volatilityValue =
    typeof volatilityItem?.value === "string" || typeof volatilityItem?.value === "number"
      ? volatilityItem.value
      : null;
  const volatility = parsePercentage(volatilityValue);

  // Growth Modifier (using CAGR from checklist item)
  if (cagr !== null) {
    if (cagr < LOW_CAGR_THRESHOLD) {
      scoreModifiers.push(LOW_GROWTH_PENALTY);
    } else if (cagr > HIGH_CAGR_THRESHOLD) {
      scoreModifiers.push(HIGH_GROWTH_BONUS);
    }
  }

  // Value Modifier (Scaled based on difference from estimate)
  if (askingPrice !== null) {
    let baseValueSource: number | null = null;
    let isFallback = false;

    // Prioritize premium estimate
    if (estSaleValueFromPremium !== null && estSaleValueFromPremium !== undefined) {
      baseValueSource = estSaleValueFromPremium;
    } else if (outcodeAvgPriceFromPremium !== null && outcodeAvgPriceFromPremium !== undefined) {
      // Use premium outcode average as fallback
      baseValueSource = outcodeAvgPriceFromPremium;
      isFallback = true;
    }

    if (baseValueSource !== null) {
      const diff = (baseValueSource - askingPrice) / askingPrice;
      const valueModifierRatio = Math.max(
        -1,
        Math.min(1, diff / VALUE_MODIFIER_SENSITIVITY_THRESHOLD)
      ); // Clamp ratio between -1 and 1

      let valueModifier = 0;
      if (valueModifierRatio > 0) {
        valueModifier = valueModifierRatio * MAX_VALUE_BONUS;
      } else if (valueModifierRatio < 0) {
        valueModifier = valueModifierRatio * Math.abs(MAX_VALUE_PENALTY);
      }

      if (isFallback) {
        valueModifier *= FALLBACK_VALUE_MODIFIER_FACTOR;
      }

      if (valueModifier !== 0) {
        scoreModifiers.push(valueModifier);
      }
    }
  }

  // Yield Modifier (using premium data)
  if (estYieldFromPremium !== null && estYieldFromPremium !== undefined) {
    if (estYieldFromPremium > HIGH_RENTAL_YIELD_THRESHOLD) {
      scoreModifiers.push(HIGH_RENTAL_YIELD_BONUS);
    } else if (estYieldFromPremium < LOW_RENTAL_YIELD_THRESHOLD) {
      scoreModifiers.push(LOW_RENTAL_YIELD_PENALTY);
    }
  }

  // Market Modifier (Turnover Rate - using premium data)
  if (outcodeTurnoverRate !== null && outcodeTurnoverRate !== undefined) {
    if (outcodeTurnoverRate < LOW_TURNOVER_THRESHOLD) {
      scoreModifiers.push(LOW_TURNOVER_PENALTY);
    } else if (outcodeTurnoverRate > HIGH_TURNOVER_THRESHOLD) {
      scoreModifiers.push(HIGH_TURNOVER_BONUS);
    }
  }

  // Propensity Modifiers (using premium data)
  if (
    propensitySellFromPremium !== null &&
    propensitySellFromPremium !== undefined &&
    propensitySellFromPremium > HIGH_PROPENSITY_SELL_THRESHOLD
  ) {
    scoreModifiers.push(HIGH_PROPENSITY_SELL_BONUS);
  }
  if (
    propensityLetFromPremium !== null &&
    propensityLetFromPremium !== undefined &&
    propensityLetFromPremium > HIGH_PROPENSITY_LET_THRESHOLD
  ) {
    scoreModifiers.push(HIGH_PROPENSITY_LET_BONUS);
  }

  // Volatility Modifier (using checklist item)
  if (volatility !== null && volatility > VOLATILITY_THRESHOLD) {
    scoreModifiers.push(HIGH_VOLATILITY_PENALTY);
  }

  // Listing History Modifier
  if (listingDaysOnMarket !== null && listingDaysOnMarket > LONG_LISTING_DURATION_THRESHOLD_DAYS) {
    scoreModifiers.push(LONG_LISTING_PENALTY);
  }
  // Apply penalty if the helper function detected a price reduction
  if (listingHistoryStatus === DataStatus.FOUND_NEGATIVE) {
    scoreModifiers.push(REDUCED_PRICE_PENALTY);
  }

  // --- Combine Modifiers ---
  const totalModifier = scoreModifiers.reduce((sum, mod) => sum + mod, 0);
  const finalScore = Math.max(0, Math.min(MAX_SCORE, BASE_SCORE + totalModifier));

  // --- Determine Label and Warnings ---
  const getScoreLabel = (score: number): string => {
    if (score >= 75) return "Strong Investment Potential";
    if (score >= 60) return "Good Investment Potential";
    if (score >= 40) return "Average Investment Potential";
    if (score >= 25) return "Below Average Investment Potential";
    return "Weak Investment Potential";
  };

  const warnings: string[] = [];
  if (preprocessedData.processedPremiumData?.status !== "success") {
    warnings.push("Premium data unavailable; some investment metrics missing or estimated.");
  }
  if (cagr === null) {
    warnings.push("Historical growth rate (CAGR) could not be determined.");
  }
  if (volatility === null) {
    warnings.push("Price volatility could not be determined.");
  }
  // Add more specific warnings based on missing premium data points if desired

  return {
    score: {
      scoreValue: Math.round(finalScore),
      maxScore: MAX_SCORE,
      scoreLabel: getScoreLabel(finalScore),
    },
    contributingItems,
    warningMessages: warnings,
  };
};
