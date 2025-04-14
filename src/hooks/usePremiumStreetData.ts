import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { useApiAuth } from "@/hooks/useApiAuth";
import { useQuery } from "@tanstack/react-query";
import { PremiumStreetDataResponse } from "../types/premiumStreetData";

interface UsePremiumStreetDataOptions {
  isAddressConfirmedByUser: boolean;
  premiumSearchActivated: boolean;
  address?: string;
  postcode?: string;
  enabled?: boolean; // Allow overriding enabled logic if needed externally
}

// This function is used to fetch the premium street data for a given address and postcode
export function usePremiumStreetData({
  isAddressConfirmedByUser,
  premiumSearchActivated,
  address,
  postcode,
  enabled = !!address && !!postcode && isAddressConfirmedByUser && premiumSearchActivated,
}: UsePremiumStreetDataOptions) {
  // Use the options object
  const { fetchWithAuth } = useApiAuth();

  const fetchPremiumStreetData = async (
    addressVal: string,
    postcodeVal: string
  ): Promise<PremiumStreetDataResponse> => {
    // Use the mock response when the flag is set
    console.log(
      "process.env.USE_PREMIUM_DATA_MOCK_ON_FRONTEND",
      process.env.USE_PREMIUM_DATA_MOCK_ON_FRONTEND
    );
    if (process.env.USE_PREMIUM_DATA_MOCK_ON_FRONTEND === "true") {
      console.log("Using mock premium street data response");
      const mockResponse = await import("@/assets/mocks/premiumDataResponse.json");

      let parsedMockResponse;

      if (typeof mockResponse === "string") {
        try {
          parsedMockResponse = JSON.parse(mockResponse);
          console.log("parsedResponse", parsedMockResponse);
        } catch (error) {
          console.error("Error parsing mockResponse.body:", error);
          throw new Error("Failed to parse mock response JSON");
        }
      } else {
        parsedMockResponse = mockResponse;
      }

      return parsedMockResponse;
    }

    // Otherwise, make the real API call with authentication
    const endpoint = `${process.env.VESTA_PROPERTY_DATA_ENDPOINT}/getPremiumStreetData`;

    // When USE_PREMIUM_DATA_MOCK_ON_BACKEND=true, we want to use the mock API
    const shouldUseMockOnBackend = process.env.USE_PREMIUM_DATA_MOCK_ON_BACKEND === "true";

    // The x-use-real-api header expects the opposite value:
    // - When shouldUseMockOnBackend=true, we set x-use-real-api=false (don't use real API)
    // - When shouldUseMockOnBackend=false, we set x-use-real-api=true (use real API)
    const xUseRealApiHeader = (!shouldUseMockOnBackend).toString();

    console.log("shouldUseMockOnBackend:", shouldUseMockOnBackend);
    console.log("x-use-real-api header value:", xUseRealApiHeader);
    console.log("endpoint:", endpoint);

    return fetchWithAuth<PremiumStreetDataResponse>(endpoint, {
      method: "POST",
      headers: {
        "x-use-real-api": xUseRealApiHeader,
      },
      body: JSON.stringify({ data: { address: addressVal, postcode: postcodeVal } }),
    });
  };

  return useQuery({
    queryKey: [REACT_QUERY_KEYS.PREMIUM_STREET_DATA, address, postcode],
    queryFn: () => fetchPremiumStreetData(address ?? "", postcode ?? ""),
    // Use the calculated/passed enabled flag
    enabled: enabled,
    staleTime: 24 * 60 * 60 * 1000, // cache for 1 day
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}
