// API response types
export type TokensResponse = {
  tokensRemaining: number;
  tokensAllocated: number;
  planTier: string;
  currentPeriodEnd: number;
};

export type PortalSessionResponse = {
  url: string;
};

export type UserProfileResponse = {
  email: string;
  name: string;
  sub: string;
  subscription: {
    planTier: string;
    tokensRemaining: number;
    tokensAllocated: number;
    currentPeriodEnd: number;
  } | null;
};

// API error response type
export type ApiErrorResponse = {
  message: string;
};
