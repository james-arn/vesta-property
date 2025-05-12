/**
 * Central color constants for the Vesta Property Inspector extension
 * These should be used instead of hardcoded color values throughout the codebase
 */

// Primary color palette
export const COLORS = {
  // Core brand colors
  PRIMARY_GREEN: "#27AE60",
  PRIMARY_GREEN_DARK: "#218838", // Darker green for hover states
  PRIMARY_GREEN_DARKER: "#155d27", // Even darker green for active states
  PRIMARY_GREEN_LIGHT: "#28a745", // Lighter green for default states

  PRIMARY_WHITE: "#F4F7F6",
  PRIMARY_DARK_BLUE: "#2C3E50",

  // Neutral colors
  WHITE: "#FFFFFF",
  BLACK: "#000000",

  // UI state colors
  SUCCESS: "#28a745",
  WARNING: "#ffc107",
  DANGER: "#dc3545",
  INFO: "#17a2b8",

  // Transparencies
  TRANSPARENT_BLACK: "rgba(0, 0, 0, 0.2)", // For shadows
};

// Aliases for common uses
export const UI = {
  PULL_TAB: {
    DEFAULT: COLORS.PRIMARY_GREEN,
    HOVER: COLORS.PRIMARY_GREEN_DARK,
    ACTIVE: COLORS.PRIMARY_GREEN,
    TEXT: COLORS.PRIMARY_WHITE,
  },

  BOOKMARK_SPINE: {
    DEFAULT: COLORS.PRIMARY_GREEN,
    HOVER: COLORS.PRIMARY_GREEN_DARK,
  },

  SHADOWS: {
    LIGHT: `2px 2px 8px ${COLORS.TRANSPARENT_BLACK}`,
  },
};
