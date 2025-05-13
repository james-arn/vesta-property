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

const MIN_ADDRESS_SIMILARITY_STRONG = 0.8;
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
