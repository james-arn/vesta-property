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
import { CategoryScoreData, PropertyDataListItem } from "@/types/property";
import { findItemByKey, parseCurrency, parsePercentage } from "@/utils/parsingHelpers";

interface InvestmentValueArgs {
  items: PropertyDataListItem[];
  outcodeTurnoverRate?: number | null;
}

/**
 * Calculates an investment value score based on property checklist items.
 * Considers growth, value comparison, rental yield, market activity, and volatility.
 * Handles missing data and prioritises premium data where applicable (implicitly via inputs).
 */
export const calculateInvestmentValueScore = ({
  items,
  outcodeTurnoverRate,
}: InvestmentValueArgs): CategoryScoreData | undefined => {
  const contributingItems: PropertyDataListItem[] = [];
  const scoreModifiers: number[] = [];

  // --- Get Values ---
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
  // Ignoring priceDiscrepancy for now due to complex parsing needs

  const volatilityItem = findItemByKey(items, "volatility");
  const volatilityValue =
    typeof volatilityItem?.value === "string" || typeof volatilityItem?.value === "number"
      ? volatilityItem.value
      : null;
  const volatility = parsePercentage(volatilityValue);
  if (volatilityItem) contributingItems.push(volatilityItem);

  const estSaleValueItem = findItemByKey(items, "estimatedSaleValue");
  const estSaleValueValue =
    typeof estSaleValueItem?.value === "string" || typeof estSaleValueItem?.value === "number"
      ? estSaleValueItem.value
      : null;
  const estSaleValue = parseCurrency(estSaleValueValue);
  if (estSaleValueItem) contributingItems.push(estSaleValueItem);

  const estYieldItem = findItemByKey(items, "estimatedAnnualRentalYield");
  const estYieldValue =
    typeof estYieldItem?.value === "string" || typeof estYieldItem?.value === "number"
      ? estYieldItem.value
      : null;
  const estYield = parsePercentage(estYieldValue);
  if (estYieldItem) contributingItems.push(estYieldItem);

  const propensitySellItem = findItemByKey(items, "propensityToSell");
  const propensitySellValue =
    typeof propensitySellItem?.value === "string" || typeof propensitySellItem?.value === "number"
      ? propensitySellItem.value
      : null;
  const propensitySell = parsePercentage(propensitySellValue);
  if (propensitySellItem) contributingItems.push(propensitySellItem);

  const propensityLetItem = findItemByKey(items, "propensityToLet");
  const propensityLetValue =
    typeof propensityLetItem?.value === "string" || typeof propensityLetItem?.value === "number"
      ? propensityLetItem.value
      : null;
  const propensityLet = parsePercentage(propensityLetValue);
  if (propensityLetItem) contributingItems.push(propensityLetItem);

  const outcodeAvgPriceItem = findItemByKey(items, "outcodeAvgSalesPrice");
  const outcodeAvgPriceValue =
    typeof outcodeAvgPriceItem?.value === "string" || typeof outcodeAvgPriceItem?.value === "number"
      ? outcodeAvgPriceItem.value
      : null;
  const outcodeAvgPrice = parseCurrency(outcodeAvgPriceValue);
  if (outcodeAvgPriceItem) contributingItems.push(outcodeAvgPriceItem);

  const outcodeActivityItem = findItemByKey(items, "outcodeMarketActivity");
  if (outcodeActivityItem) contributingItems.push(outcodeActivityItem);

  const outcodeTotalPropsItem = findItemByKey(items, "outcodeTotalProperties");
  if (outcodeTotalPropsItem) contributingItems.push(outcodeTotalPropsItem);

  const marketTurnoverRateItem = findItemByKey(items, "marketTurnoverRate");
  if (marketTurnoverRateItem) contributingItems.push(marketTurnoverRateItem);

  // --- Calculate Modifiers ---

  // Growth Modifier
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

    if (estSaleValue !== null) {
      baseValueSource = estSaleValue;
    } else if (outcodeAvgPrice !== null) {
      baseValueSource = outcodeAvgPrice;
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
        // Undervalued: ratio is positive, use positive MAX_VALUE_BONUS
        valueModifier = valueModifierRatio * MAX_VALUE_BONUS;
      } else if (valueModifierRatio < 0) {
        // Overvalued: ratio is negative, use absolute of negative MAX_VALUE_PENALTY
        valueModifier = valueModifierRatio * Math.abs(MAX_VALUE_PENALTY);
      }

      // Apply fallback factor if using outcode average
      if (isFallback) {
        valueModifier *= FALLBACK_VALUE_MODIFIER_FACTOR;
      }

      // Add the calculated modifier (can be 0 if diff is small)
      if (valueModifier !== 0) {
        scoreModifiers.push(valueModifier);
      }
    }
  }

  // Yield Modifier
  if (estYield !== null) {
    if (estYield > HIGH_RENTAL_YIELD_THRESHOLD) {
      scoreModifiers.push(HIGH_RENTAL_YIELD_BONUS);
    } else if (estYield < LOW_RENTAL_YIELD_THRESHOLD) {
      scoreModifiers.push(LOW_RENTAL_YIELD_PENALTY);
    }
  }

  // Market Modifier (Turnover Rate) - Use passed-in rate
  if (outcodeTurnoverRate !== null && outcodeTurnoverRate !== undefined) {
    if (outcodeTurnoverRate < LOW_TURNOVER_THRESHOLD) {
      scoreModifiers.push(LOW_TURNOVER_PENALTY);
    } else if (outcodeTurnoverRate > HIGH_TURNOVER_THRESHOLD) {
      scoreModifiers.push(HIGH_TURNOVER_BONUS);
    }
  }

  // Propensity Modifiers (kept separate)
  if (propensitySell !== null && propensitySell > HIGH_PROPENSITY_SELL_THRESHOLD) {
    scoreModifiers.push(HIGH_PROPENSITY_SELL_BONUS);
  }
  if (propensityLet !== null && propensityLet > HIGH_PROPENSITY_LET_THRESHOLD) {
    scoreModifiers.push(HIGH_PROPENSITY_LET_BONUS);
  }

  // Volatility Modifier
  if (volatility !== null && volatility > VOLATILITY_THRESHOLD) {
    scoreModifiers.push(HIGH_VOLATILITY_PENALTY);
  }

  // --- Final Score and Label ---
  // Calculate score by reducing modifiers starting from base
  const totalScore = scoreModifiers.reduce((acc, modifier) => acc + modifier, BASE_SCORE);
  const finalScore = Math.max(0, Math.min(MAX_SCORE, Math.round(totalScore))); // Clamp and round

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return "Excellent Potential";
    if (score >= 60) return "Good Potential";
    if (score >= 45) return "Average Potential";
    if (score >= 25) return "Below Average Potential";
    return "Low Potential";
  };

  const scoreLabel = getScoreLabel(finalScore);

  // Return undefined if no relevant data points were found at all?
  // For now, return even if based on few/no factors.
  if (contributingItems.length === 0) {
    console.warn("Investment Value score calculated with no contributing items.");
    // Return a default neutral score or undefined
    return {
      score: { scoreValue: 50, maxScore: 100, scoreLabel: "Average Potential" },
      contributingItems: [],
    };
  }

  return {
    score: { scoreValue: finalScore, maxScore: MAX_SCORE, scoreLabel },
    contributingItems,
  };
};
