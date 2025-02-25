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

  // Otherwise, make the real API call.
  const endpoint = `${process.env.VESTA_AWS_ENDPOINT}/getPremiumStreetData`;
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: { address, postcode } }),
  };

  const response = await fetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`Network response was not ok: ${response.statusText}`);
  }
  return response.json();
};

export function usePremiumStreetData(
  isAddressConfirmedByUser: boolean,
  address?: string,
  postcode?: string
) {
  return useQuery({
    queryKey: [REACT_QUERY_KEYS.PREMIUM_STREET_DATA, address, postcode],
    queryFn: () => fetchPremiumStreetData(address ?? "", postcode ?? ""),
    enabled: !!address && !!postcode && isAddressConfirmedByUser,
    staleTime: 24 * 60 * 60 * 1000, // cache for 1 day
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}
