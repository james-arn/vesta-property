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
  LOW_CAGR_THRESHOLD,
  LOW_GROWTH_PENALTY,
  LOW_RENTAL_YIELD_PENALTY,
  LOW_RENTAL_YIELD_THRESHOLD,
  LOW_TURNOVER_PENALTY,
  LOW_TURNOVER_THRESHOLD,
  MAX_SCORE,
  MAX_VALUE_BONUS,
  MAX_VALUE_PENALTY,
  VALUE_MODIFIER_SENSITIVITY_THRESHOLD,
  VOLATILITY_THRESHOLD,
} from "@/constants/scoreConstants";
import { CategoryScoreData, PreprocessedData, PropertyDataListItem } from "@/types/property";
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
  const contributingItems: PropertyDataListItem[] = [];
  const scoreModifiers: number[] = [];

  // --- Extract data from PreprocessedData ---
  const premiumData = preprocessedData.processedPremiumData;
  const outcodeTurnoverRate = premiumData?.outcodeTurnoverRate;
  const estSaleValueFromPremium = premiumData?.estimatedSaleValue;
  const estYieldFromPremium = premiumData?.estimatedAnnualRentalYield;
  const propensitySellFromPremium = premiumData?.propensityToSell;
  const propensityLetFromPremium = premiumData?.propensityToLet;
  const outcodeAvgPriceFromPremium = premiumData?.outcodeAvgSalesPrice;

  // --- Get Values from Checklist Items (can be overridden by premium data later if needed) ---
  const askingPriceItem = findItemByKey(items, "price");
  const askingPriceValue =
    typeof askingPriceItem?.value === "string" || typeof askingPriceItem?.value === "number"
      ? askingPriceItem.value
      : null;
  const askingPrice = parseCurrency(askingPriceValue);
  if (askingPriceItem) contributingItems.push(askingPriceItem);

  const cagrItem = findItemByKey(items, "compoundAnnualGrowthRate");
  const cagrValue =
    typeof cagrItem?.value === "string" || typeof cagrItem?.value === "number"
      ? cagrItem.value
      : null;
  const cagr = parsePercentage(cagrValue);
  if (cagrItem) contributingItems.push(cagrItem);

  const volatilityItem = findItemByKey(items, "volatility");
  const volatilityValue =
    typeof volatilityItem?.value === "string" || typeof volatilityItem?.value === "number"
      ? volatilityItem.value
      : null;
  const volatility = parsePercentage(volatilityValue);
  if (volatilityItem) contributingItems.push(volatilityItem);

  // Add checklist items that might display premium data to contributingItems
  const estSaleValueItem = findItemByKey(items, "estimatedSaleValue");
  if (estSaleValueItem) contributingItems.push(estSaleValueItem);
  const estYieldItem = findItemByKey(items, "estimatedAnnualRentalYield");
  if (estYieldItem) contributingItems.push(estYieldItem);
  const propensitySellItem = findItemByKey(items, "propensityToSell");
  if (propensitySellItem) contributingItems.push(propensitySellItem);
  const propensityLetItem = findItemByKey(items, "propensityToLet");
  if (propensityLetItem) contributingItems.push(propensityLetItem);
  const outcodeAvgPriceItem = findItemByKey(items, "outcodeAvgSalesPrice");
  if (outcodeAvgPriceItem) contributingItems.push(outcodeAvgPriceItem);
  const marketTurnoverRateItem = findItemByKey(items, "marketTurnoverRate");
  if (marketTurnoverRateItem) contributingItems.push(marketTurnoverRateItem);

  // --- Calculate Modifiers using preprocessed data where available ---

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

  const combinedWarningMessage = warnings.length > 0 ? warnings.join(" ") : undefined;

  return {
    score: {
      scoreValue: Math.round(finalScore),
      maxScore: MAX_SCORE,
      scoreLabel: getScoreLabel(finalScore),
    },
    contributingItems,
    warningMessage: combinedWarningMessage,
  };
};
