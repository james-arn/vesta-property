import { logErrorToSentry } from "@/utils/sentry";

// --- Interfaces ---
// Consider moving these to a shared types file if used elsewhere

interface HousePricesTransaction {
  displayPrice: string;
  dateSold: string; // e.g., "8 Oct 2024"
  tenure?: string;
  newBuild?: boolean;
}

interface HousePricesProperty {
  address: string;
  bedrooms?: number | null;
  transactions?: HousePricesTransaction[];
  latestTransaction?: HousePricesTransaction; // Sometimes only latestTransaction is present
}

interface HousePricesPageModel {
  searchResult?: {
    properties?: HousePricesProperty[];
  };
}

export interface AddressLookupPayload {
  targetSaleYear: string | null;
  targetSalePrice: string | null;
  targetBedrooms: number | null;
  nearbySoldPropertiesPath: string | null;
}

// --- Helper Functions ---

const parsePrice = (priceString: string | null | undefined): number | null => {
  if (!priceString) return null;
  try {
    return parseInt(priceString.replace(/[^0-9]/g, ""), 10);
  } catch (error) {
    logErrorToSentry(
      `Error parsing price: ${priceString} - ${error instanceof Error ? error.message : String(error)}`,
      "warning"
    );
    return null;
  }
};

const extractYearFromDate = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  const yearMatch = dateString.match(/\b(\d{4})\b/); // Use double backslash for literal backslash in string
  return yearMatch ? yearMatch[1] : null; // Group 1 captures the year digits
};

// --- Main Lookup Function ---

/**
 * Fetches the Rightmove house prices page, extracts the embedded PAGE_MODEL,
 * and attempts to find a matching property based on sale history.
 *
 * @param payload - The lookup criteria containing target sale info and the URL path.
 * @returns The full address string if a match is found, otherwise null.
 */
export const lookupAddressFromHousePricesPage = async (
  payload: AddressLookupPayload
): Promise<string | null> => {
  const { targetSaleYear, targetSalePrice, targetBedrooms, nearbySoldPropertiesPath } = payload;

  // Basic validation - need the path and at least one piece of sale info to match
  if (!nearbySoldPropertiesPath || (!targetSaleYear && !targetSalePrice)) {
    console.warn(
      "[Address Lookup Helper] lookupAddressFromHousePricesPage skipped: Missing nearbySoldPropertiesPath or both targetSaleYear and targetSalePrice."
    );
    return null;
  }

  const targetUrl = `https://www.rightmove.co.uk${nearbySoldPropertiesPath}`;
  const parsedTargetPrice = parsePrice(targetSalePrice);
  let foundAddress: string | null = null;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} for ${targetUrl}`);
    }
    const html = await response.text();

    // Regex to extract the PAGE_MODEL JSON string
    const pageModelRegex = /window\.PAGE_MODEL\s*=\s*({[\s\S]*?});?\s*<\/script>/;
    const match = html.match(pageModelRegex);

    if (match && match[1]) {
      const pageModelString = match[1];
      const pageModel: HousePricesPageModel = JSON.parse(pageModelString);

      if (pageModel.searchResult?.properties) {
        const properties = pageModel.searchResult.properties;

        const matchedProperty = properties.find((prop) => {
          const transactionsToSearch = prop.transactions?.length
            ? prop.transactions
            : prop.latestTransaction
              ? [prop.latestTransaction]
              : [];

          return transactionsToSearch.some((transaction) => {
            const currentPriceStr = transaction.displayPrice;
            const currentDateStr = transaction.dateSold;
            const currentBedrooms = prop.bedrooms;

            const currentPrice = parsePrice(currentPriceStr);
            const currentYear = extractYearFromDate(currentDateStr);

            const priceMatch =
              !parsedTargetPrice || (!!currentPrice && currentPrice === parsedTargetPrice);
            const yearMatch = !targetSaleYear || (!!currentYear && currentYear === targetSaleYear);
            const bedroomsMatch =
              targetBedrooms === null ||
              (currentBedrooms !== null &&
                currentBedrooms !== undefined &&
                currentBedrooms === targetBedrooms);

            const requiresYearMatch = !!targetSaleYear;
            const requiresPriceMatch = !!parsedTargetPrice;
            let overallSaleDataMatch = false;

            if (requiresYearMatch && requiresPriceMatch) {
              overallSaleDataMatch = yearMatch && priceMatch;
            } else if (requiresYearMatch) {
              overallSaleDataMatch = yearMatch;
            } else if (requiresPriceMatch) {
              overallSaleDataMatch = priceMatch;
            }

            return overallSaleDataMatch && bedroomsMatch;
          });
        });

        if (matchedProperty) {
          foundAddress = matchedProperty.address;
          console.log(
            `[Address Lookup Helper] Match found via find/some: Address: ${foundAddress}`
          );
        } else {
          console.log(`[Address Lookup Helper] No matching property found in PAGE_MODEL data.`);
        }
      } else {
        logErrorToSentry(
          "[Address Lookup Helper] searchResult.properties not found in PAGE_MODEL.",
          "warning"
        );
      }
    } else {
      logErrorToSentry(
        "[Address Lookup Helper] window.PAGE_MODEL regex found no match in fetched HTML.",
        "warning"
      );
      // Consider adding DOM scraping fallback here if needed in the future
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logErrorToSentry(
      `[Address Lookup Helper] Error during fetch/parse for ${targetUrl}: ${errorMsg}`,
      "error"
    );
    foundAddress = null; // Ensure address is null on error
  }

  return foundAddress;
};
