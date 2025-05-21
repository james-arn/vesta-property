import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { useToast } from "@/hooks/use-toast";
import { useApiAuth } from "@/hooks/useApiAuth";
import {
  ApiErrorResponse,
  GetPremiumStreetDataResponse,
  PremiumFetchContext,
} from "@/types/premiumStreetData";
import { ExtractedPropertyScrapingData } from "@/types/property";
import { trackGA4TokenUsed } from "@/utils/GoogleAnalytics/googleAnalyticsEvents";
import { UseMutateFunction, useMutation, useQueryClient } from "@tanstack/react-query";

interface UseActivatePremiumSearchReturn {
  activatePremiumSearch: UseMutateFunction<
    GetPremiumStreetDataResponse | null,
    Error & { response?: Response },
    PremiumFetchContext,
    unknown
  >;
  isActivatingPremiumSearch: boolean;
  activatePremiumSearchError: Error | ApiErrorResponse | null;
}

export function usePersistentPremiumData(): UseActivatePremiumSearchReturn {
  const { fetchWithAuth } = useApiAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const performPremiumActivationRequest = async (
    context: PremiumFetchContext
  ): Promise<GetPremiumStreetDataResponse | null> => {
    // Removed frontend validation for confirmedAddress - Backend will handle this.

    // MOCK HANDLING...
    // useMockFrontend true will not hit api and will just use local json data based on a real api call.
    // dev build will also hit dev api endpoint that will return mock data and not cost.
    // Use a production bbuild to hit the prod api to test the real api and incur real costs of 50p per request.
    const useMockFrontend = process.env.USE_PREMIUM_DATA_MOCK_ON_FRONTEND === "true";
    const useMockBackend = process.env.USE_PREMIUM_DATA_MOCK_ON_BACKEND === "true";
    if (useMockFrontend) {
      console.log("Using mock premium street data response (Frontend Activation)");
      // Add a check here for mock context validity if needed for testing
      if (!context?.currentContext?.confirmedAddress?.displayAddress) {
        console.warn("Mock activation called without confirmed address in context for testing.");
      }
      try {
        const mockModule = await import("@/assets/mocks/premiumDataResponse.json");
        const oldMockData = mockModule.default;
        const mockResponse: GetPremiumStreetDataResponse = {
          premiumData: oldMockData as any,
          tokensRemaining: 9,
          dataSource: "api",
        };
        console.log("Constructed Mock response:", mockResponse);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return mockResponse;
      } catch (e) {
        console.error("Failed to load or parse mock activation response:", e);
        throw new Error("Failed to load mock data");
      }
    }

    const endpoint = `${process.env.VESTA_PROPERTY_DATA_ENDPOINT}/getPremiumStreetData`;
    const xUseRealApiHeader = (!useMockBackend).toString();

    console.log("Sending Premium Activation Request to Backend:", context);
    console.log("x-use-real-api:", xUseRealApiHeader);

    try {
      // Let fetchWithAuth handle the API call and potential errors
      const response = await fetchWithAuth<GetPremiumStreetDataResponse>(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-use-real-api": xUseRealApiHeader,
        },
        body: JSON.stringify(context),
      });
      return response; // Return the successful response
    } catch (error) {
      console.error("Error during premium activation request:", error);
      throw error; // Re-throw the error for useMutation's onError to handle
    }
  };

  const activatePremiumSearchMutation = useMutation<
    GetPremiumStreetDataResponse | null,
    Error & { response?: Response }, // Error type expects potential Response object
    PremiumFetchContext,
    unknown
  >({
    mutationFn: performPremiumActivationRequest,
    onSuccess: (data, variables) => {
      const activatedPropertyId = variables.propertyId;
      if (!activatedPropertyId || !data) return;

      queryClient.setQueryData([REACT_QUERY_KEYS.PREMIUM_STREET_DATA, activatedPropertyId], data);

      // --- Invalidate so new token count is fetched in profile ---
      queryClient.invalidateQueries({ queryKey: [REACT_QUERY_KEYS.USER_PROFILE] });

      if (data.dataSource === "api") {
        trackGA4TokenUsed({
          property_id: activatedPropertyId,
        });
      }

      const toastTitle = data.snapshotData
        ? "Premium Search Reloaded - No Tokens Used"
        : "Premium Search Successful";
      const toastDescription = `Tokens remaining: ${data.tokensRemaining}`;

      toast({
        title: toastTitle,
        description: toastDescription,
      });

      // Update property data cache only if data was from snapshot (cache hit)
      if (data.snapshotData) {
        console.log("Premium data reloaded from cache. Updating property data cache.");
        queryClient.setQueryData<ExtractedPropertyScrapingData>(
          [REACT_QUERY_KEYS.PROPERTY_DATA, activatedPropertyId],
          (oldData) => {
            if (!oldData) return undefined;
            const { confirmedAddress, epc } = data.snapshotData!;
            if (!confirmedAddress || !epc) {
              console.warn("Snapshot data missing critical fields. PROP cache not updated.");
              return oldData;
            }
            return { ...oldData, address: confirmedAddress, epc: epc };
          }
        );
      }
    },
    onError: async (error, variables) => {
      console.error("Mutation onError - Raw Error:", error);
      let errorData: ApiErrorResponse | null = null;
      let status = 500;
      let response: Response | undefined = undefined;

      // Check if the error object has a response property that is an instance of Response
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response instanceof Response
      ) {
        response = error.response;
        status = response.status;
        try {
          const body = await response.json();
          // Check if the parsed body looks like our expected API error
          if (body && (typeof body.error === "string" || typeof body.message === "string")) {
            errorData = body as ApiErrorResponse;
          }
        } catch (jsonError) {
          console.error("Failed to parse error JSON from response:", jsonError);
          // Keep status as is, but errorData remains null
        }
      } else {
        // Log unexpected error structure
        console.warn("Mutation onError received error without standard Response object:", error);
      }

      console.log(`Handling error with status: ${status}`, errorData);

      switch (status) {
        case 400:
          toast({
            variant: "destructive",
            title: "Invalid Request",
            description:
              errorData?.message ||
              "Failed due to invalid address. Please double check the address and try again.",
          });
          break;
        case 401:
          toast({
            variant: "destructive",
            title: "Authentication Required",
            description: "Authentication failed. Please log in again.",
          });
          // Potentially trigger re-authentication flow here
          break;
        case 403:
          toast({
            variant: "destructive",
            title: "Insufficient Credits",
            description: "You do not have enough credits for this search.",
          });
          break;
        case 404:
          toast({
            variant: "destructive",
            title: "Not Found",
            description: "Required user or property details not found.",
          });
          break;
        case 503:
          const baseMessage =
            errorData?.error || "The premium data service is temporarily unavailable.";
          let description503 = baseMessage;
          if (errorData?.tokensRestored && typeof errorData?.tokensRemaining === "number") {
            console.log(`Token restored after 503. Remaining: ${errorData.tokensRemaining}`);
            description503 = `${baseMessage} Your token was restored. Tokens remaining: ${errorData.tokensRemaining}`;
          }
          toast({
            variant: "destructive",
            title: "Service Unavailable",
            description: description503,
          });
          break;
        default: // Includes 500 and any other status
          toast({
            variant: "destructive",
            title: "Error activating premium search",
            description: "An unexpected server error occurred. Please try again later.",
          });
      }
    },
  });

  return {
    activatePremiumSearch: activatePremiumSearchMutation.mutate,
    isActivatingPremiumSearch: activatePremiumSearchMutation.isPending,
    activatePremiumSearchError: activatePremiumSearchMutation.error
      ? (activatePremiumSearchMutation.error as Error | ApiErrorResponse)
      : null,
  };
}
