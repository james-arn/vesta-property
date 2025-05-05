export interface UserProfile {
  userId: string;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    isRecurring: boolean;
    tokens: {
      remaining: number;
      total: number;
    };
  };
  searchedPropertyIds: string[];
}
