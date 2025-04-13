export const EPC_RATING_REGEX = /EPC(?:\s+Rating)?\s*[:\-]?\s*([A-G])/i;

// Regex for new fields
export const LEASE_TERM_REGEX = /(?:lease term|remaining lease|lease length)[:\s]*(\d+)\s*years?/i;
export const GROUND_RENT_REGEX = /ground rent[:\s]*([£$€]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
export const SERVICE_CHARGE_REGEX = /service charge[:\s]*([£$€]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
// More specific regex to capture explicitly mentioned annual service charge
export const SERVICE_CHARGE_ANNUAL_REGEX =
  /(?:annual figure of|annually)[:\s]*([£$€]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
