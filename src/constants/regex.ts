export const heatingRegex =
  /\b(?:gas central heating|electric heating|electric central heating|underfloor heating|radiators|boiler)\b/gi;
export const gardenRegex = /\bgarden\b(?!.*communal garden)/gi;
export const parkingRegex = /\bparking\b/gi;

export const RIGHTMOVE_PROPERTY_PAGE_REGEX =
  /^https:\/\/www\.rightmove\.co\.uk\/(properties\/|property-for-sale\/|property-to-rent\/)/;

export const outcodeRegex = /^([A-Z]{1,2}[0-9R][0-9A-Z]?)/i; // Matches M1, SW1A, WR11 etc.

export const EPC_CURRENT_RATING_REGEX = /property['’]s energy rating is ([A-G])\./i;
export const EPC_POTENTIAL_RATING_REGEX = /potential to be ([A-G])\./i;
