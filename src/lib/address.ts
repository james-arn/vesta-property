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
  let parts = addressWithoutPostcode
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // 3. Process the first part (potential building/street)
  let buildingGuess = "";
  let streetGuess = "";
  if (parts.length > 0) {
    const firstPart = parts[0];
    // Heuristic 1: Check if first part looks like "Number Street"
    const buildingStreetMatch = firstPart.match(/^(\d+(?:-\d+)?(?:[A-Za-z])?)\s+(.*)/);
    if (buildingStreetMatch) {
      buildingGuess = buildingStreetMatch[1]; // The number/range part
      streetGuess = buildingStreetMatch[2]; // The rest of the first part
    } else {
      // Heuristic 2: Check if the *entire* first part is just a number/identifier
      // and we have at least one more part (which could be the street)
      const numberOnlyMatch = firstPart.match(/^(\d+(?:-\d+)?(?:[A-Za-z])?)$/);
      if (numberOnlyMatch && parts.length > 1) {
        buildingGuess = numberOnlyMatch[1]; // Assign number to building
        streetGuess = parts[1]; // Assign the *second* part as the street
        // Adjust town parts accordingly (start from index 2)
        parts = parts.slice(1); // Modify parts array for town calculation below
      } else {
        // Fallback: Assume the whole first part is street or building name (difficult to distinguish)
        buildingGuess = "";
        streetGuess = firstPart;
      }
    }
  } else {
    // If no parts after splitting (e.g., only postcode was removed), put remainder here?
    streetGuess = addressWithoutPostcode; // Or should this be empty?
  }

  // 4. Determine town based on remaining parts (index 1 onwards, unless adjusted above)
  const townGuess = parts.length > 1 ? parts.slice(1).join(", ") : "";

  return {
    buildingGuess: buildingGuess || "",
    streetGuess: streetGuess || "",
    townGuess: townGuess || "",
    postcodeGuess: safePostcode,
  };
};
