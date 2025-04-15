export const EPC_RATING_REGEX = /EPC(?:\s+Rating)?\s*[:\-]?\s*([A-G])/i;

// Regex for new fields
export const LEASE_TERM_REGEX = /(?:lease term|remaining lease|lease length)[:\s]*(\d+)\s*years?/i;
export const GROUND_RENT_REGEX = /ground rent[:\s]*([£$€]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
export const SERVICE_CHARGE_REGEX = /service charge[:\s]*([£$€]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
// More specific regex to capture explicitly mentioned annual service charge
export const SERVICE_CHARGE_ANNUAL_REGEX =
  /(?:annual figure of|annually)[:\s]*([£$€]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;

export const NEARBY_SCHOOLS_BUTTON_SELECTOR = "#Schools-button";
export const SCHOOL_ROW_SELECTOR_PREFIX = '[data-test^="school-"]';
export const BROADBAND_BUTTON_SELECTOR = 'div[data-gtm-name="broadband-checker"]';
export const BROADBAND_SPEED_VALUE_SELECTOR = 'div[data-testid="broadband-speed-value"]';
export const PROPERTY_SALE_HISTORY_BUTTON_SELECTOR = 'button[data-testid="see-all-history"]';
export const SALE_HISTORY_ROW_SELECTOR = '[data-testid^="sale-history-row-"]';
export const DEFAULT_WAIT_TIMEOUT = 3000;
