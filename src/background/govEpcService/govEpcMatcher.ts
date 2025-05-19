import { GovEpcCertificate, GovEpcValidationMatch } from "@/types/govEpcCertificate";
import { ExtractedPropertyScrapingData } from "@/types/property";
import { logErrorToSentry } from "@/utils/sentry";
import { jaroWinkler } from "jaro-winkler-typescript";

/**
 * Calculates string similarity using Jaro-Winkler algorithm.
 * Score ranges from 0 (no similarity) to 1 (exact match).
 * Strings are cleaned (lowercase, remove special chars, trim) before comparison.
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  // Clean strings: lowercase, remove non-alphanumeric (except spaces), normalize spaces, trim
  const s1 = str1
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const s2 = str2
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Use jaroWinkler for similarity calculation, case-insensitive
  return jaroWinkler(s1, s2, { caseSensitive: false });
}

const MIN_ADDRESS_SIMILARITY_STRONG = 0.85;
const MIN_ADDRESS_SIMILARITY_ACCEPTABLE_FOR_OVERRIDE = 0.75;
const MIN_ADDRESS_SIMILARITY_MEDIUM = 0.6;
const determineMatchStrength = (
  addressScore: number,
  epcMatch: boolean
): GovEpcValidationMatch["overallMatchStrength"] => {
  if (addressScore >= MIN_ADDRESS_SIMILARITY_STRONG) {
    return epcMatch ? "strong" : "medium";
  }
  if (addressScore >= MIN_ADDRESS_SIMILARITY_MEDIUM) {
    return epcMatch ? "medium" : "weak";
  }
  return "weak";
};

export function findBestGovEpcMatch(
  govCertificates: GovEpcCertificate[],
  currentPropertyData: ExtractedPropertyScrapingData
): GovEpcValidationMatch | null {
  if (!govCertificates || govCertificates.length === 0) return null;

  const propertyAddress = currentPropertyData.address?.displayAddress?.toLowerCase() || "";
  const propertyEpc = currentPropertyData.epc?.value?.toLowerCase() || "";

  console.log(
    "[GovEpcMatcher] findBestGovEpcMatch: Comparing against Property Address:",
    propertyAddress,
    "Property EPC:",
    propertyEpc
  );

  const scoredMatches = govCertificates.map((cert) => {
    const retrievedAddressLower = cert.retrievedAddress?.toLowerCase() || "";
    const addressMatchScore = calculateStringSimilarity(propertyAddress, retrievedAddressLower);
    const isEpcRatingMatch = propertyEpc === (cert.retrievedRating?.toLowerCase() || "");
    const overallMatchStrength = determineMatchStrength(addressMatchScore, isEpcRatingMatch);

    return {
      ...cert,
      addressMatchScore,
      isEpcRatingMatch,
      overallMatchStrength,
    };
  });

  const potentialMatches = scoredMatches.filter(
    (match) =>
      match.overallMatchStrength === "strong" ||
      (match.overallMatchStrength === "medium" &&
        match.addressMatchScore >= MIN_ADDRESS_SIMILARITY_MEDIUM)
  );

  if (potentialMatches.length === 0) return null;

  // Sort potential matches: strong first, then by address match score
  const sortedMatches = [...potentialMatches].sort((a, b) => {
    if (a.overallMatchStrength === "strong" && b.overallMatchStrength !== "strong") return -1;
    if (b.overallMatchStrength === "strong" && a.overallMatchStrength !== "strong") return 1;
    // If same strength (e.g. both medium), prioritize higher address score
    if (a.overallMatchStrength === b.overallMatchStrength) {
      return b.addressMatchScore - a.addressMatchScore;
    }
    // This case should ideally not be reached if sorting by strength categories first
    return b.addressMatchScore - a.addressMatchScore;
  });

  const bestCandidate = sortedMatches[0];

  if (bestCandidate.overallMatchStrength === "strong") return bestCandidate;
  if (
    bestCandidate.overallMatchStrength === "medium" &&
    bestCandidate.isEpcRatingMatch && // Crucial for a medium match to be "best"
    bestCandidate.addressMatchScore >= MIN_ADDRESS_SIMILARITY_MEDIUM
  ) {
    return bestCandidate;
  }

  return null;
}

/**
 * Finds the single best matching government EPC certificate based purely on address similarity.
 * This is intended to be used when we want the government data to override listing data
 * if a sufficiently strong and unique address match is found.
 * @param govCertificates - Array of government EPC certificates.
 * @param propertyAddress - The address string of the property we are trying to match.
 * @returns The best GovEpcCertificate if a confident unique match is found, otherwise null.
 */
export function findBestAddressMatchInGovCertificates(
  govCertificates: GovEpcCertificate[],
  propertyAddress: string
): GovEpcCertificate | null {
  if (!govCertificates || govCertificates.length === 0 || !propertyAddress) {
    return null;
  }

  const propertyAddressLower = propertyAddress.toLowerCase();

  const scoredCertificates = govCertificates.map((cert) => {
    const retrievedAddressLower = cert.retrievedAddress?.toLowerCase() || "";
    const addressMatchScore = calculateStringSimilarity(
      propertyAddressLower,
      retrievedAddressLower
    );
    return {
      ...cert,
      addressMatchScore,
    };
  });

  // Filter for certificates with a high enough address similarity score
  const potentialMatches = scoredCertificates.filter(
    (cert) => cert.addressMatchScore >= MIN_ADDRESS_SIMILARITY_ACCEPTABLE_FOR_OVERRIDE
  );

  if (potentialMatches.length === 0) {
    return null;
  }

  // Sort by address match score in descending order
  potentialMatches.sort((a, b) => b.addressMatchScore - a.addressMatchScore);

  // Check if the best match is significantly better than the second best
  if (potentialMatches.length > 1) {
    const topMatch = potentialMatches[0];
    const secondMatch = potentialMatches[1];

    // If the top score isn't strong enough, it's ambiguous or not a good enough override candidate.
    if (topMatch.addressMatchScore < MIN_ADDRESS_SIMILARITY_STRONG) {
      // MIN_ADDRESS_SIMILARITY_STRONG = 0.85
      console.log(
        "[GovEpcMatcher] Top address match score not strong enough for override:",
        topMatch.addressMatchScore
      );
      return null;
    }

    const scoreDifference = topMatch.addressMatchScore - secondMatch.addressMatchScore;

    // Tiered approach to ambiguity based on the strength of the topMatch score:
    if (topMatch.addressMatchScore >= 0.95) {
      // Tier 1: Very high confidence match (e.g., 0.95+)
      // If top score is extremely high, only declare ambiguous if second is also extremely high and very close.
      if (scoreDifference < 0.03 && secondMatch.addressMatchScore >= 0.9) {
        console.log(
          "[GovEpcMatcher] Ambiguity (Tier 1): Top match >=0.95, but second match >=0.90 and diff <0.03."
        );
        return null;
      }
    } else if (topMatch.addressMatchScore >= 0.9) {
      // Tier 2: High confidence match (e.g., 0.90-0.94)
      // If top score is high, require a more significant difference to distinguish.
      if (scoreDifference < 0.04 && secondMatch.addressMatchScore > MIN_ADDRESS_SIMILARITY_MEDIUM) {
        console.log(
          `[GovEpcMatcher] Ambiguity (Tier 2): Top match ${topMatch.addressMatchScore.toFixed(4)} ('${topMatch.retrievedAddress}') ` +
            `vs Second ${secondMatch.addressMatchScore.toFixed(4)} ('${secondMatch.retrievedAddress}') ` +
            `diff ${scoreDifference.toFixed(4)} < 0.04.`
        );
        return null;
      }
    } else {
      // Tier 3: Strong confidence match (e.g., 0.85-0.89, as it passed the <0.85 check earlier)
      // Original threshold for "strong but not high" matches.
      if (scoreDifference < 0.1 && secondMatch.addressMatchScore > MIN_ADDRESS_SIMILARITY_MEDIUM) {
        console.log(
          "[GovEpcMatcher] Ambiguity (Tier 3): Top match 0.85-0.89, but second > medium (0.6) and diff <0.1."
        );
        return null;
      }
    }
    // If none of the above ambiguity conditions are met, the topMatch is considered unique enough.
  } else if (potentialMatches.length === 1) {
    // Single potential match, check if its score is strong enough
    if (potentialMatches[0].addressMatchScore < MIN_ADDRESS_SIMILARITY_STRONG) {
      console.log(
        "[GovEpcMatcher] Single potential address match score not strong enough for override:",
        potentialMatches[0].addressMatchScore
      );
      return null;
    }
  } else {
    // potentialMatches.length === 0 - This case should ideally be caught by the filter earlier
    return null;
  }

  // If we have one clear winner (or a single strong enough match that passed above checks)
  const bestMatch = potentialMatches[0];

  // Return the original certificate object without the score
  const { addressMatchScore, ...originalCert } = bestMatch;
  return originalCert;
}

export function getPlausibleGovEpcMatches(
  govCertificates: GovEpcCertificate[],
  currentPropertyData: ExtractedPropertyScrapingData,
  minSimilarity = MIN_ADDRESS_SIMILARITY_MEDIUM
): GovEpcValidationMatch[] {
  if (
    !govCertificates ||
    govCertificates.length === 0 ||
    !currentPropertyData?.address?.displayAddress
  ) {
    return [];
  }
  const { displayAddress: listingDisplayAddress } = currentPropertyData.address;
  const listingEpcValue = currentPropertyData.epc?.value;

  try {
    return govCertificates
      .map((cert) => {
        const addressMatchScore = calculateStringSimilarity(
          listingDisplayAddress,
          cert.retrievedAddress
        );
        const isEpcRatingMatch = !!(
          listingEpcValue &&
          cert.retrievedRating &&
          listingEpcValue.toUpperCase() === cert.retrievedRating.toUpperCase()
        );
        const overallMatchStrength = determineMatchStrength(addressMatchScore, isEpcRatingMatch);
        return {
          ...cert,
          addressMatchScore,
          isEpcRatingMatch,
          overallMatchStrength,
        };
      })
      .filter((match) => match.addressMatchScore >= minSimilarity)
      .sort((a, b) => b.addressMatchScore - a.addressMatchScore); // Sort by score, descending
  } catch (error: any) {
    console.error("[GovEpcMatcher] Error in getPlausibleGovEpcMatches:", error);
    logErrorToSentry(error);
    return [];
  }
}
