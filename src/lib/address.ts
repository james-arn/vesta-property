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

  const addressWithoutPostcode =
    safePostcode && safeDisplayAddress.endsWith(safePostcode)
      ? safeDisplayAddress
          .substring(0, safeDisplayAddress.length - safePostcode.length)
          .trim()
          .replace(/,$/, "")
      : safeDisplayAddress;

  const parts = addressWithoutPostcode
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let buildingGuess = "";
  let streetGuess = "";
  let townPartsStartIndex = 0; // Default: town would effectively start from parts[0] if no building/street found

  if (parts.length > 0) {
    const firstPart = parts[0];
    // Heuristic: Check if firstPart ("Number Street Name") contains both building and street
    const buildingStreetMatch = firstPart.match(/^(\d+(?:-\d+)?(?:[A-Za-z])?)\s+(.*)/);
    if (buildingStreetMatch) {
      buildingGuess = buildingStreetMatch[1]; // e.g., "123"
      streetGuess = buildingStreetMatch[2]; // e.g., "Main Street"
      townPartsStartIndex = 1; // Town parts start from the next element in `parts` (i.e. parts[1])
    } else {
      // Default assignment: Part 1 (parts[0]) is building. Subsequent parts are street, then town.
      buildingGuess = firstPart;
      townPartsStartIndex = 1; // After building (parts[0]), next is potentially street (parts[1]) then town (parts[2+])

      if (parts.length > 1) {
        streetGuess = parts[1];
        townPartsStartIndex = 2; // Street took parts[1], so town starts from parts[2]
      }
      // If parts.length is 1 (only buildingGuess was assigned from parts[0]),
      // streetGuess remains "", and townPartsStartIndex means town would be sought from parts[1] (which doesn't exist).
    }
  }

  // Determine town based on remaining parts, using townPartsStartIndex
  const townGuess =
    parts.length > townPartsStartIndex ? parts.slice(townPartsStartIndex).join(", ") : "";

  return {
    buildingGuess: buildingGuess,
    streetGuess: streetGuess,
    townGuess: townGuess,
    postcodeGuess: safePostcode,
  };
};
