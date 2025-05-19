import { outcodeRegex } from "@/constants/regex";

export const stripOutcodeFromTown = (
  townCandidate: string | null | undefined,
  fullPostcode: string | null | undefined
): string => {
  if (!townCandidate || !fullPostcode) {
    return townCandidate || "";
  }

  const trimmedPostcode = fullPostcode.trim();
  const postcodeParts = trimmedPostcode.split(" ");
  let outcode: string | undefined = undefined;

  if (postcodeParts.length > 0 && postcodeParts[0].length > 0) {
    const potentialOutcode = postcodeParts[0].toUpperCase();
    // Basic validation for outcode: contains at least one letter and is 2-4 chars long.
    if (
      /[A-Z]/.test(potentialOutcode) &&
      potentialOutcode.length >= 2 &&
      potentialOutcode.length <= 4
    ) {
      outcode = potentialOutcode;
    }
  }

  // Fallback if no space was found, try regex on the whole string (e.g. "SW1A2AA")
  if (!outcode && trimmedPostcode.length >= 5) {
    // Minimum length for a postcode like M11AA

    const match = trimmedPostcode.match(outcodeRegex);
    if (match && match[0] && match[0].length >= 2 && match[0].length <= 4) {
      outcode = match[0].toUpperCase();
    }
  }

  if (outcode) {
    let currentTown = townCandidate;
    const upperTown = currentTown.toUpperCase();
    const upperOutcode = outcode; // Already uppercased

    if (upperTown.endsWith(` ${upperOutcode}`)) {
      currentTown = currentTown.substring(0, currentTown.length - (upperOutcode.length + 1)).trim();
    } else if (upperTown.endsWith(upperOutcode)) {
      // Only strip if the town is longer than the outcode itself
      if (currentTown.length > upperOutcode.length) {
        currentTown = currentTown.substring(0, currentTown.length - upperOutcode.length).trim();
      }
    }
    return currentTown;
  }
  return townCandidate;
};
