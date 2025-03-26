import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { DataStatus } from "@/types/property";
import { logErrorToSentry } from "@/utils/sentry";
import { useQuery } from "@tanstack/react-query";

export type CrimeScoreResponse = {
  crimeRating: "High" | "Moderate" | "Low";
  crimeScore: string;
  crimeSummary: Record<string, number>;
  monthsAggregated: string[];
  totalCrimes: number;
  trendingPercentageOver6Months: number;
};

export type CrimeScoreData = CrimeScoreResponse & {
  crimeStatus: DataStatus;
};

export function getCrimeScoreStatus(
  isCrimeScoreLoading: boolean,
  crimeScoreData?: CrimeScoreData
): DataStatus {
  if (isCrimeScoreLoading) {
    return DataStatus.IS_LOADING;
  }
  return crimeScoreData?.crimeStatus ?? DataStatus.ASK_AGENT;
}

export function getCrimeScoreValue(
  isCrimeScoreLoading: boolean,
  crimeScoreData?: CrimeScoreData,
  crimeScoreError?: Error | null
): string {
  if (isCrimeScoreLoading) {
    return "Calculating...";
  }
  if (crimeScoreError) {
    return "Unable to find, check with agent";
  }
  return crimeScoreData?.crimeRating ?? "Unable to find, check with agent";
}

const fetchCrimeScore = async (lat: string, lng: string): Promise<CrimeScoreResponse> => {
  const endpoint = `${process.env.VESTA_PROPERTY_DATA_PRODUCTION_ONLY_ENDPOINT}/crime-report?lat=${lat}&lng=${lng}`;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      // Log error directly here before throwing.
      const error = new Error(`Network response was not ok: ${response.statusText}`);
      logErrorToSentry(error);
      throw error;
    }
    const json = await response.json();
    return json;
  } catch (error) {
    // Log unexpected errors as well.
    if (error instanceof Error) {
      logErrorToSentry(error);
      throw error;
    }
    throw new Error("Unknown error occurred while fetching crime score");
  }
};

export function useCrimeScore(lat: string, lng: string) {
  return useQuery({
    queryKey: [REACT_QUERY_KEYS.CRIME_SCORE, lat, lng],
    queryFn: () => fetchCrimeScore(lat, lng),
    staleTime: 24 * 60 * 60 * 1000, // Cache the data for 1 day
    enabled: !!lat && !!lng,
    // Add status directly into the returned data.
    select: (data: CrimeScoreResponse): CrimeScoreData => {
      const crimeStatus =
        data.crimeRating === "Low" ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT;
      return { ...data, crimeStatus };
    },
  });
}
