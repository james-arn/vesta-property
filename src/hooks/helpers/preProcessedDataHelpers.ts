import { ProcessedPremiumDataStatus, RestrictiveCovenant } from "@/types/premiumStreetData";

export const processRestrictiveCovenants = (
  premiumStatus: ProcessedPremiumDataStatus,
  premiumCovenants: RestrictiveCovenant[] | null | undefined,
  initialRestrictions: boolean | null | undefined
): RestrictiveCovenant[] | null => {
  // 1. Handle Successful Premium Query
  if (premiumStatus === "success") {
    if (Array.isArray(premiumCovenants)) {
      // Premium definitively found covenants (or lack thereof)
      return premiumCovenants; // Returns the array (could be empty [])
    }
    // If premiumCovenants is null/undefined despite success, fall through to initial scrape
  }

  // 2. Handle Failed/Pending Premium Query OR Successful Query with null/undefined covenants
  // Fallback to initial boolean scrape result
  if (initialRestrictions === true) {
    // Know they exist from scrape, but no details available (or premium didn't provide)
    return null;
  } else if (initialRestrictions === false) {
    // Know they don't exist from scrape
    return [];
  } else {
    // Initial scrape data is also null/undefined (truly unknown)
    return null;
  }
};
