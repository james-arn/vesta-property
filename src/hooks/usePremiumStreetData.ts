import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { useQuery } from "@tanstack/react-query";
import { PremiumStreetDataResponse } from "../types/premiumStreetData";

const fetchPremiumStreetData = async (
  address: string,
  postcode: string
): Promise<PremiumStreetDataResponse> => {
  // Use the mock response when the flag is set
  console.log("process.env.USE_PREMIUM_DATA_MOCK", process.env.USE_PREMIUM_DATA_MOCK);
  if (process.env.USE_PREMIUM_DATA_MOCK === "true") {
    console.log("Using mock premium street data response");
    const mockResponse = await import("@/assets/mocks/premiumDataResponse.json");
    // The mock file's body may be a stringified JSON so we try to parse it if necessary.
    const parsedResponse =
      typeof mockResponse.body === "string" ? JSON.parse(mockResponse.body) : mockResponse;
    return {
      data: parsedResponse,
      meta: {
        address_match_confidence: 1,
        request_cost_gbp: 0,
        balance_gbp: 0,
      },
    };
  }

  // Otherwise, make the real API call.
  const endpoint = `${process.env.VESTA_AWS_ENDPOINT}/premium-street-data`;
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: { address, postcode },
    }),
  };

  const response = await fetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`Network response was not ok: ${response.statusText}`);
  }
  return response.json();
};

export function usePremiumStreetData(address: string, postcode: string) {
  return useQuery({
    queryKey: [REACT_QUERY_KEYS.PREMIUM_STREET_DATA, address, postcode],
    queryFn: () => fetchPremiumStreetData(address, postcode),
    staleTime: 24 * 60 * 60 * 1000, // cache for 1 day
    enabled: Boolean(address) && Boolean(postcode),
  });
}
