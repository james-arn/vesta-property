interface ParsedAddressGuess {
  buildingGuess: string;
  streetGuess: string;
  townGuess: string;
  postcodeGuess: string;
}

/**
 * Attempts to parse a display address string and postcode into structured guesses.
 * NOTE: Address parsing is complex; this is a basic heuristic.
 * @param displayAddress The full display address string (nullable).
 * @param postcode The postcode string (nullable).
 * @returns An object with guesses for building, street, town, and postcode.
 */
export const parseDisplayAddress = (
  displayAddress: string | null,
  postcode: string | null
): ParsedAddressGuess => {
  const safeDisplayAddress = displayAddress ?? "";
  const safePostcode = postcode ?? "";

  // 1. Attempt to remove postcode from the end
  const addressWithoutPostcode =
    safePostcode && safeDisplayAddress.endsWith(safePostcode)
      ? safeDisplayAddress
          .substring(0, safeDisplayAddress.length - safePostcode.length)
          .trim()
          .replace(/,$/, "")
      : safeDisplayAddress;

  // 2. Split the remaining string by comma
  const parts = addressWithoutPostcode
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // 3. Process the first part (potential building/street)
  let buildingGuess = "";
  let streetGuess = "";
  if (parts.length > 0) {
    const firstPart = parts[0];
    // Very basic heuristic: check if first word is a number (or range like 1-3)
    const buildingMatch = firstPart.match(/^(\d+(?:-\d+)?(?:[A-Za-z])?)\s+(.*)/);
    if (buildingMatch) {
      buildingGuess = buildingMatch[1]; // The number/range part
      streetGuess = buildingMatch[2]; // The rest of the first part
    } else {
      // If no number found, assume the whole first part might be street or building name
      // It's hard to distinguish reliably without context or better parsing library
      // Let's put it all in street for now, user can correct
      buildingGuess = "";
      streetGuess = firstPart;
    }
  } else {
    // If no parts after splitting (e.g., only postcode was removed), put remainder here?
    streetGuess = addressWithoutPostcode; // Or should this be empty?
  }

  // 4. Determine town based on remaining parts
  const townGuess = parts.length > 1 ? parts.slice(1).join(", ") : "";

  return {
    buildingGuess: buildingGuess || "",
    streetGuess: streetGuess || "",
    townGuess: townGuess || "",
    postcodeGuess: safePostcode,
  };
};
