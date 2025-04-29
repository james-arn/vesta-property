import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { useApiAuth } from "@/hooks/useApiAuth";
import { GetPremiumStreetDataResponse, PremiumFetchContext } from "@/types/premiumStreetData";
import { ExtractedPropertyScrapingData } from "@/types/property"; // Import main data type
import { UseMutateFunction, useMutation, useQueryClient } from "@tanstack/react-query";

interface UseActivatePremiumSearchReturn {
  activatePremiumSearch: UseMutateFunction<
    GetPremiumStreetDataResponse | null, // Backend might still return null structure on error?
    Error,
    PremiumFetchContext, // Takes the full context
    unknown
  >;
  isActivating: boolean;
  activationError: Error | null;
}

export function usePersistentPremiumData(): UseActivatePremiumSearchReturn {
  const { fetchWithAuth } = useApiAuth();
  const queryClient = useQueryClient();

  // Simplified fetch function - only handles the activation case
  const performPremiumActivationRequest = async (
    context: PremiumFetchContext // No isManualActivation flag needed
  ): Promise<GetPremiumStreetDataResponse | null> => {
    // MOCK HANDLING - Keep for testing activation
    const useMockFrontend = process.env.USE_PREMIUM_DATA_MOCK_ON_FRONTEND === "true";
    const useMockBackend = process.env.USE_PREMIUM_DATA_MOCK_ON_BACKEND === "true";

    if (useMockFrontend) {
      console.log("Using mock premium street data response (Frontend Activation)");
      try {
        const mockModule = await import("@/assets/mocks/premiumDataResponse.json");
        const oldMockData = mockModule.default;
        console.log("Old Mock data:", oldMockData);

        // Construct the new expected structure
        // Cast oldMockData to the expected inner type.
        // Using 'as any' because the structure in premiumDataResponse.json
        // TUpdate premiumDataResponse.json to match types or handle mock discrepancies better.
        const mockResponse: GetPremiumStreetDataResponse = {
          premiumData: oldMockData as any, // Use 'as any' for mock data discrepancy
          snapshotData: undefined,
        };
        console.log("Constructed Mock response:", mockResponse);
        return mockResponse;
      } catch (e) {
        console.error("Failed to load or parse mock activation response:", e);
        return null;
      }
    }
    // END MOCK HANDLING

    const endpoint = `${process.env.VESTA_PROPERTY_DATA_ENDPOINT}/getPremiumStreetData`;
    const xUseRealApiHeader = (!useMockBackend).toString();

    console.log("Sending Premium Activation Request:", context);
    console.log("x-use-real-api:", xUseRealApiHeader);

    // No specific 404 handling needed here as it's always an activation attempt
    try {
      const response = await fetchWithAuth<GetPremiumStreetDataResponse>(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-use-real-api": xUseRealApiHeader,
        },
        body: JSON.stringify(context),
      });
      // Assume backend returns the full response on success, or throws error
      return response;
    } catch (error) {
      console.error("Error activating premium search:", error);
      throw error; // Re-throw for useMutation to handle in onError
    }
  };

  // --- Mutation for Manual Activation ---
  const activatePremiumSearchMutation = useMutation<
    GetPremiumStreetDataResponse | null,
    Error,
    PremiumFetchContext,
    unknown
  >({
    mutationFn: performPremiumActivationRequest,
    onSuccess: (data, variables) => {
      const activatedPropertyId = variables.propertyId;
      if (!activatedPropertyId) return;

      // Update the cache with the response from the activation
      // Downstream useQuery hooks will pick this up
      queryClient.setQueryData([REACT_QUERY_KEYS.PREMIUM_STREET_DATA, activatedPropertyId], data);

      // If snapshot data was returned, update the PROPERTY_DATA cache
      const snapshotData = data?.snapshotData;
      if (snapshotData) {
        console.log("Restoring/confirming snapshot data from activation response");
        queryClient.setQueryData<ExtractedPropertyScrapingData>(
          [REACT_QUERY_KEYS.PROPERTY_DATA, activatedPropertyId],
          (oldData) => {
            if (!oldData) return undefined;
            const confirmedAddress = snapshotData.confirmedAddress;
            const epc = snapshotData.epc;
            if (!confirmedAddress || !epc) {
              console.warn(
                "Snapshot data exists but missing critical fields (address/epc). PROPERTY_DATA cache not updated."
              );
              return oldData;
            }
            return {
              ...oldData,
              address: confirmedAddress,
              epc: epc,
            };
          }
        );
      }
    },
    // TODO: adding onError for specific error handling/messaging
    // onError: (error, variables) => { ... }
  });

  return {
    activatePremiumSearch: activatePremiumSearchMutation.mutate,
    isActivating: activatePremiumSearchMutation.isPending,
    activationError: activatePremiumSearchMutation.error,
  };
}
