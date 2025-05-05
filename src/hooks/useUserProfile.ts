// hooks/useUserProfile.ts
import { ENV_CONFIG } from "@/constants/environmentConfig";
import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { UserProfile } from "@/types/userProfile";
import { useQuery } from "@tanstack/react-query";
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

export function useUserProfile() {
  const { fetchWithAuth } = useApiAuth();

  const fetchUserProfile = async (): Promise<UserProfile> => {
    // fetchWithAuth already handles errors and returns parsed JSON or throws
    return await fetchWithAuth<UserProfile>(`${ENV_CONFIG.VESTA_USER_ENDPOINT}/profile`, {
      method: "GET",
    });
  };

  const { data, isLoading, error, isError } = useQuery<UserProfile, Error>({
    queryKey: [REACT_QUERY_KEYS.USER_PROFILE],
    queryFn: fetchUserProfile,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  return {
    userProfile: data,
    isLoadingUserProfile: isLoading,
    userProfileError: isError ? error : null,
  };
}

export default useUserProfile;
