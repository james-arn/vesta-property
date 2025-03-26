// hooks/useUserProfile.ts
import { ENV_CONFIG } from "@/constants/environmentConfig";
import { toast } from "@/hooks/use-toast";
import { useCallback, useState } from "react";
import { useApiAuth } from "./useApiAuth";

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

const useUserProfile = () => {
  const { fetchWithAuth, isLoading, error } = useApiAuth();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);

  const fetchUserProfile = useCallback(async () => {
    try {
      const data = await fetchWithAuth<UserProfileResponse>(
        `${ENV_CONFIG.VESTA_USER_ENDPOINT}/profile`
      );
      setProfile(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch user profile";
      toast({
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  }, [fetchWithAuth, ENV_CONFIG.VESTA_USER_ENDPOINT]);

  return { profile, isLoading, error, fetchUserProfile };
};

export default useUserProfile;
