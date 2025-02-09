import { multiplierCAGRThreshold } from "@/constants/thresholds";
import { clickPropertySaleHistoryButton } from "@/contentScript/utils/propertyScrapeHelpers";
import {
  DataStatus,
  NOT_APPLICABLE,
  PriceDiscrepancyReason,
  SaleHistoryEntry,
} from "@/types/property";

/**
 * Returns a promise that resolves once a table with a "Year sold" header is found in the DOM.
 */
const getPropertySaleHistoryTableFromDOM = (): Promise<HTMLTableElement | null> =>
  new Promise((resolve) => {
    const checkForTable = () => {
      const tables = Array.from(document.querySelectorAll("table"));
      const matchingTable = tables.find((table) => {
        const headerText = table.querySelector("thead th")?.textContent?.trim();
        return headerText === "Year sold";
      });
      if (matchingTable) {
        resolve(matchingTable as HTMLTableElement);
      }
    };

    // Check immediately in case the table is already in the DOM
    checkForTable();

    const observer = new MutationObserver(() => checkForTable());
    observer.observe(document.body, { childList: true, subtree: true });

    // Stop observing after a timeout (e.g., 5 seconds)
    setTimeout(() => {
      observer.disconnect();
      console.error("Property sale history table not found within timeout.");
      resolve(null);
    }, 5000);
  });

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
const extractPropertySaleHistory = async (): Promise<SaleHistoryEntry[]> => {
  const table = await getPropertySaleHistoryTableFromDOM();
  if (!table) {
    console.error("Property sale history table not found.");
    return [];
  }
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const saleHistory = rows
    .map((row) => {
      const yearSold = row.querySelector("td:nth-child(1)")?.textContent?.trim();
      const soldPrice = row.querySelector("td:nth-child(2) span")?.textContent?.trim();
      const change = row.querySelector("td:nth-child(3) div")?.textContent?.trim() || "0%";
      return yearSold && soldPrice ? { year: yearSold, soldPrice, percentageChange: change } : null;
    })
    .filter((entry): entry is SaleHistoryEntry => entry !== null);
  // Sort from most recent to oldest (based on year)
  return saleHistory.sort((a, b) => parseInt(b.year) - parseInt(a.year));
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
  // Trigger dynamic loading via the sale history button
  clickPropertySaleHistoryButton();
  const saleHistory = await extractPropertySaleHistory();

  const currentYear = new Date().getFullYear().toString();
  // Add current listing as the most recent sale if available
  const updatedHistory: SaleHistoryEntry[] = currentListingPrice
    ? [
        {
          year: currentYear,
          soldPrice: currentListingPrice,
          percentageChange: "0%",
        },
        ...saleHistory,
      ]
    : saleHistory;

  // Check if there is a previous sale record; if not, we assume this is a new build.
  if (updatedHistory.length < 2) {
    // No previous sale data available
    const result = {
      priceDiscrepancyValue: NOT_APPLICABLE,
      priceDiscrepancyStatus: DataStatus.FOUND_POSITIVE,
      priceDiscrepancyReason: PriceDiscrepancyReason.NO_PREVIOUS_SOLD_HISTORY,
      compoundAnnualGrowthRate: null,
      volatility: NOT_APPLICABLE,
    };
    console.log(result);

    return result;
  }

  // --- Price Discrepancy Calculation ---
  // looks at the most recent sale and the sale before that
  const latestPrice = parseSoldPrice(updatedHistory[0].soldPrice);
  const previousPrice = parseSoldPrice(updatedHistory[1].soldPrice);

  if (latestPrice === null || previousPrice === null) {
    console.error("Invalid price data: latestPrice or previousPrice is null.");
    return {
      priceDiscrepancyValue: NOT_APPLICABLE,
      priceDiscrepancyStatus: DataStatus.ASK_AGENT,
      priceDiscrepancyReason: PriceDiscrepancyReason.MISSING_OR_INVALID_PRICE_DATA,
      compoundAnnualGrowthRate: null,
      volatility: NOT_APPLICABLE,
    };
  }

  // Calculate the raw percentage change between most recent and previous sold prices.
  const priceJumpOrLossPercent = ((latestPrice - previousPrice) / previousPrice) * 100;

  const latestYear = parseInt(updatedHistory[0].year);
  const previousYear = parseInt(updatedHistory[1].year);
  const timeGap = latestYear - previousYear;

  // Prepare a discrepancy string that shows the change and the time gap.
  const priceDiscrepancyStr = `${priceJumpOrLossPercent.toFixed(2)}% over ${timeGap} year${timeGap > 1 ? "s" : ""}`;

  const { priceDiscrepancyStatus, priceDiscrepancyReason } = (() => {
    if (!latestPrice || !previousPrice || previousPrice <= 0) {
      return {
        priceDiscrepancyStatus: DataStatus.ASK_AGENT,
        priceDiscrepancyReason: PriceDiscrepancyReason.MISSING_OR_INVALID_PRICE_DATA,
      };
    }

    // If it's a price drop, immediately flag it.
    if (latestPrice < previousPrice) {
      return {
        priceDiscrepancyStatus: DataStatus.ASK_AGENT,
        priceDiscrepancyReason: PriceDiscrepancyReason.PRICE_DROP,
      };
    }
    // Calculate the local annual growth rate from the two latest prices.
    const currentAnnualGrowth = Math.pow(latestPrice / previousPrice, 1 / timeGap) - 1;

    // Calculate historical CAGR using only past closed sales (exclude the current listing price).
    // updatedHistory[0] is the current asking price and the rest is historical data:
    const historicalData = updatedHistory.slice(1);
    let historicalCAGR: number | null = null;
    if (historicalData.length >= 2) {
      const sortedHistory = historicalData
        .slice()
        .sort((a, b) => parseInt(a.year) - parseInt(b.year));
      const startPriceHist = parseSoldPrice(sortedHistory[0].soldPrice);
      const endPriceHist = parseSoldPrice(sortedHistory[sortedHistory.length - 1].soldPrice);
      const histYears =
        parseInt(sortedHistory[sortedHistory.length - 1].year) - parseInt(sortedHistory[0].year);
      if (startPriceHist && endPriceHist && histYears > 0) {
        historicalCAGR = Math.pow(endPriceHist / startPriceHist, 1 / histYears) - 1;
      }
    }

    // Use the historical CAGR if available to decide if the price increase is too steep.
    if (historicalCAGR !== null && currentAnnualGrowth > historicalCAGR * multiplierCAGRThreshold) {
      return {
        priceDiscrepancyStatus: DataStatus.ASK_AGENT,
        priceDiscrepancyReason: PriceDiscrepancyReason.PRICE_GAP_EXCEEDS_EXPECTED_RANGE,
      };
    }
    return {
      priceDiscrepancyStatus: DataStatus.FOUND_POSITIVE,
      priceDiscrepancyReason: PriceDiscrepancyReason.PRICE_GAP_WITHIN_EXPECTED_RANGE,
    };
  })();

  // --- CAGR Calculation ---
  const cagrVal = calculateCompundAnnualGrowthRate(updatedHistory);

  // --- Volatility Calculation ---
  // If there is insufficient data (fewer than 3 data points), volatility is not meaningful.
  let volatilityStr: string;
  if (updatedHistory.length < 3) {
    volatilityStr = "N/A";
  } else {
    const computedChanges = updatedHistory.slice(1).map((entry, i) => {
      const prevPrice = parseSoldPrice(updatedHistory[i].soldPrice);
      const currPrice = parseSoldPrice(entry.soldPrice);
      return prevPrice && currPrice && prevPrice > 0
        ? ((currPrice - prevPrice) / prevPrice) * 100
        : 0;
    });
    const meanChange =
      computedChanges.length > 0
        ? computedChanges.reduce((acc, v) => acc + v, 0) / computedChanges.length
        : 0;
    const volatility =
      computedChanges.length > 0
        ? Math.sqrt(
            computedChanges.reduce((acc, v) => acc + (v - meanChange) ** 2, 0) /
              computedChanges.length
          )
        : 0;
    volatilityStr = `${volatility.toFixed(2)}%`;
  }

  const result = {
    priceDiscrepancyValue: priceDiscrepancyStr,
    priceDiscrepancyStatus,
    priceDiscrepancyReason,
    compoundAnnualGrowthRate: cagrVal,
    volatility: volatilityStr,
  };

  console.log(result);
  return result;
};

export default getPropertySalesInsights;
