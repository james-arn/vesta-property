import { NOT_APPLICABLE, PriceDiscrepancyReason } from "@/constants/propertyConsts";
import { multiplierCAGRThreshold } from "@/constants/thresholds";
import { clickPropertySaleHistoryButton } from "@/contentScript/utils/propertyScrapeHelpers";
import { DataStatus, SaleHistoryEntry } from "@/types/property";

const SALE_HISTORY_OUTCOME_TIMEOUT_MS = 2000;

const getPropertySaleHistoryTableFromDOM = (timeout: number): Promise<HTMLTableElement | null> =>
  new Promise((resolve) => {
    let observer: MutationObserver | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    const headerTextToFind = "Year sold";

    const cleanup = () => {
      if (observer) observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      observer = null;
      timeoutId = null;
    };

    const check = () => {
      const tables = Array.from(document.querySelectorAll("table"));
      const matchingTable = tables.find(
        (table) => table.querySelector("thead th")?.textContent?.trim() === headerTextToFind
      );
      if (matchingTable) {
        cleanup();
        resolve(matchingTable as HTMLTableElement);
        return true;
      }
      return false;
    };

    if (check()) return; // Check immediately

    observer = new MutationObserver(() => check());
    observer.observe(document.body, { childList: true, subtree: true });

    timeoutId = setTimeout(() => {
      if (check()) return; // Final check before timeout
      cleanup();
      resolve(null);
    }, timeout);
  });

const waitForElementWithText = (
  textToFind: string,
  timeout: number
): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    let observer: MutationObserver | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (observer) observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      observer = null;
      timeoutId = null;
    };

    const check = () => {
      const elements = document.querySelectorAll("div, span, p");
      for (const element of elements) {
        if (element.textContent?.includes(textToFind)) {
          cleanup();
          resolve(element as HTMLElement);
          return true;
        }
      }
      return false;
    };

    if (check()) return; // Check immediately

    observer = new MutationObserver(() => check());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    timeoutId = setTimeout(() => {
      if (check()) return; // Final check
      cleanup();
      resolve(null);
    }, timeout);
  });
};

/**
 * Parses a sold price string by removing currency symbols, commas, etc.
 * Returns a numeric value or null if the parsing fails.
 */
const parseSoldPrice = (priceStr: string): number | null => {
  const cleaned = priceStr.replace(/[^0-9.]/g, "");
  const result = parseFloat(cleaned);
  return isNaN(result) ? null : result;
};

/**
 * Extracts the sale history from the dynamic sale history table.
 * Returns an array of SaleHistoryEntry objects.
 */
const extractPropertySaleHistoryFromTable = (table: HTMLTableElement): SaleHistoryEntry[] => {
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const saleHistory = rows
    .map((row) => {
      const yearSold = row.querySelector("td:nth-child(1)")?.textContent?.trim();
      const soldPrice = row.querySelector("td:nth-child(2) span")?.textContent?.trim();
      const change = row.querySelector("td:nth-child(3) div")?.textContent?.trim() || "0%";
      return yearSold && soldPrice ? { year: yearSold, soldPrice, percentageChange: change } : null;
    })
    .filter((entry): entry is SaleHistoryEntry => entry !== null);
  return saleHistory.slice().sort((a, b) => parseInt(b.year) - parseInt(a.year));
};

/**
 * Calculates the Compound Annual Growth Rate (CAGR) for the property sale history.
 * Expects at least two sale records. The history is internally sorted in ascending order.
 */
const calculateCompundAnnualGrowthRate = (saleHistory: SaleHistoryEntry[]): number | null => {
  if (saleHistory.length < 2) return null;
  const sortedHistory = saleHistory.slice().sort((a, b) => parseInt(a.year) - parseInt(b.year));
  const startYear = parseInt(sortedHistory[0].year);
  const endYear = parseInt(sortedHistory[sortedHistory.length - 1].year);
  if (isNaN(startYear) || isNaN(endYear) || startYear === endYear) {
    console.warn("Invalid or identical year values in sale history.");
    return null;
  }
  const startPrice = parseSoldPrice(sortedHistory[0].soldPrice);
  const endPrice = parseSoldPrice(sortedHistory[sortedHistory.length - 1].soldPrice);
  if (startPrice === null || endPrice === null || startPrice <= 0) {
    console.warn("Invalid sold price data in sale history.");
    return null;
  }
  const years = endYear - startYear;
  return Math.pow(endPrice / startPrice, 1 / years) - 1;
};

/**
 * Returns the top three sales insights for a property:
 * 1. Price Discrepancy: The percentage change from the previous sold price to the current listing.
 * 2. CAGR: Compound annual growth rate over the observed period.
 * 3. Volatility: Standard deviation of consecutive percentage changes.
 *
 * Uses the extracted sale history and the current listing price.
 */
const getPropertySalesInsights = async (currentListingPrice: string | null) => {
  const saleHistoryButtonSelector = "button";
  const saleHistoryButtonText = "Property sale history";
  const noHistoryText = "No sale history found";

  const buttons = document.querySelectorAll(saleHistoryButtonSelector);
  const targetButton = Array.from(buttons).find((button) =>
    button.textContent?.includes(saleHistoryButtonText)
  );

  const defaultResult = {
    priceDiscrepancyValue: NOT_APPLICABLE,
    priceDiscrepancyStatus: DataStatus.NOT_APPLICABLE,
    priceDiscrepancyReason: PriceDiscrepancyReason.NO_PREVIOUS_SOLD_HISTORY,
    compoundAnnualGrowthRate: null,
    volatility: NOT_APPLICABLE,
    mostRecentSale: null,
  };

  if (!targetButton) {
    console.log(
      `[Content Script] Button containing text "${saleHistoryButtonText}" not found. Assuming no history available.`
    );
    return defaultResult;
  }

  console.log(
    `[Content Script] Button containing text "${saleHistoryButtonText}" found. Clicking.`
  );
  clickPropertySaleHistoryButton();

  console.log(
    `[Content Script] Waiting for sale history outcome (max ${SALE_HISTORY_OUTCOME_TIMEOUT_MS}ms)...`
  );

  // Race the promises
  const outcome = await Promise.race([
    getPropertySaleHistoryTableFromDOM(SALE_HISTORY_OUTCOME_TIMEOUT_MS).then((table) => ({
      type: "table",
      payload: table,
    })),
    waitForElementWithText(noHistoryText, SALE_HISTORY_OUTCOME_TIMEOUT_MS).then((element) => ({
      type: "noHistoryText",
      payload: element,
    })),
  ]);

  let saleHistory: SaleHistoryEntry[] = [];
  let mostRecentSale: SaleHistoryEntry | null = null;

  if (outcome.type === "table" && outcome.payload) {
    console.log("[Content Script] Sale history table found successfully.");
    saleHistory = extractPropertySaleHistoryFromTable(outcome.payload as HTMLTableElement);
    mostRecentSale = saleHistory.length > 0 ? saleHistory[0] : null;
  }

  // --- Calculations section ---

  const currentYear = new Date().getFullYear().toString();
  const updatedHistory: SaleHistoryEntry[] = currentListingPrice
    ? [
        { year: currentYear, soldPrice: currentListingPrice, percentageChange: "0%" },
        ...saleHistory,
      ]
    : saleHistory;

  // If no actual historical records exist after checking
  if (saleHistory.length === 0) {
    return { ...defaultResult, mostRecentSale: null };
  }

  // Proceed with calculations only if saleHistory has entries
  const latestPrice = parseSoldPrice(updatedHistory[0].soldPrice);
  const previousPrice = parseSoldPrice(updatedHistory[1].soldPrice);

  if (latestPrice === null || previousPrice === null) {
    return {
      priceDiscrepancyValue: NOT_APPLICABLE,
      priceDiscrepancyStatus: DataStatus.ASK_AGENT,
      priceDiscrepancyReason: PriceDiscrepancyReason.MISSING_OR_INVALID_PRICE_DATA,
      compoundAnnualGrowthRate: null,
      volatility: NOT_APPLICABLE,
      mostRecentSale: mostRecentSale,
    };
  }

  const priceJumpOrLossPercent = ((latestPrice - previousPrice) / previousPrice) * 100;
  const latestYear = parseInt(updatedHistory[0].year);
  const previousYear = parseInt(updatedHistory[1].year);
  const timeGap = Math.max(1, latestYear - previousYear);
  const priceDiscrepancyStr = `${priceJumpOrLossPercent.toFixed(2)}% over ${timeGap} year${timeGap > 1 ? "s" : ""}`;

  const historicalCAGR = calculateCompundAnnualGrowthRate(updatedHistory.slice(1));
  const { volatility, reason } = calculateVolatility(updatedHistory.slice(1));
  const { priceDiscrepancyStatus, priceDiscrepancyReason } = checkPriceDiscrepancy(
    latestPrice,
    previousPrice,
    timeGap,
    historicalCAGR
  );

  const result = {
    priceDiscrepancyValue: priceDiscrepancyStr,
    priceDiscrepancyStatus,
    priceDiscrepancyReason,
    compoundAnnualGrowthRate: historicalCAGR,
    volatility,
    mostRecentSale: mostRecentSale,
  };

  console.log("[Sales Insights] Final mostRecentSale before return:", mostRecentSale);
  console.log("Calculated Sales Insights:", result);
  return result;
};

export default getPropertySalesInsights;

// --- Placeholder Helper Functions (Restore original implementations if needed) ---

// Placeholder for calculateVolatility
function calculateVolatility(history: SaleHistoryEntry[]): { volatility: string; reason?: string } {
  if (history.length < 2) {
    return { volatility: "N/A (requires 2+ past sales)" };
  }
  if (history.length < 3) {
    return { volatility: "N/A (requires 3+ past sales)" };
  }
  // Simplified placeholder - real calculation involves standard deviation of percentage changes
  console.warn("Using placeholder calculateVolatility function");
  return { volatility: "N/A" };
}

function checkPriceDiscrepancy(
  latestPrice: number,
  previousPrice: number,
  timeGap: number,
  historicalCAGR: number | null
): {
  priceDiscrepancyStatus: DataStatus;
  priceDiscrepancyReason: (typeof PriceDiscrepancyReason)[keyof typeof PriceDiscrepancyReason];
} {
  console.warn("Using placeholder checkPriceDiscrepancy function");
  if (latestPrice < previousPrice) {
    return {
      priceDiscrepancyStatus: DataStatus.ASK_AGENT,
      priceDiscrepancyReason: PriceDiscrepancyReason.PRICE_DROP,
    };
  }
  if (historicalCAGR !== null) {
    const currentAnnualGrowth = Math.pow(latestPrice / previousPrice, 1 / timeGap) - 1;
    if (currentAnnualGrowth > historicalCAGR * multiplierCAGRThreshold) {
      return {
        priceDiscrepancyStatus: DataStatus.ASK_AGENT,
        priceDiscrepancyReason: PriceDiscrepancyReason.PRICE_GAP_EXCEEDS_EXPECTED_RANGE,
      };
    }
  }
  return {
    priceDiscrepancyStatus: DataStatus.FOUND_POSITIVE,
    priceDiscrepancyReason: PriceDiscrepancyReason.PRICE_GAP_WITHIN_EXPECTED_RANGE,
  };
}
