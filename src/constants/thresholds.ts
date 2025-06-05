// A volatility below 10% is considered stable.
export const volatilityThreshold = 10;

// 1.5 indicates that the annual growth from the current listing is 50% higher than the historical CAGR) that flags an unusual price increase.
export const multiplierCAGRThreshold = 1.5;

export const INITIAL_REVIEW_COUNT_THRESHOLD = 10; // if INITIAL_REVIEW page is seen >= 10 times

export const FINAL_STEP_EMAIL_SENT_COUNT_THRESHOLD = 2; // if EMAIL_SENT page is seen >= 3 times
