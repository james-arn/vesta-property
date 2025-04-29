import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { CrimeScoreData } from "@/hooks/useCrimeScore";
import { generatePropertyChecklist } from "@/sidepanel/propertychecklist/propertyChecklist";
import { GetPremiumStreetDataResponse } from "@/types/premiumStreetData";
import {
  CategoryScoreData,
  DashboardScores,
  ExtractedPropertyScrapingData,
  PreprocessedData,
  PropertyDataListItem,
} from "@/types/property";
import {
  calculateDashboardScores,
  CalculatedDashboardResult as CalculationResultType,
} from "@/utils/scoreCalculations";
import { useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { usePreprocessedPropertyData } from "./usePreprocessedPropertyData";

export interface UseChecklistAndDashboardDataArgs {
  propertyData: ExtractedPropertyScrapingData | null;
  crimeScoreQuery: UseQueryResult<CrimeScoreData, Error> | undefined;
  epcDebugCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isEpcDebugModeOn: boolean;
  isAuthenticated: boolean;
}

export interface UseChecklistAndDashboardDataResult {
  propertyChecklistData: PropertyDataListItem[];
  preprocessedData: PreprocessedData;
  categoryScores: DashboardScores;
  overallScore: number | null;
  dataCoverageScoreData: CategoryScoreData | undefined;
  premiumDataQuery: UseQueryResult<GetPremiumStreetDataResponse | null, Error>;
}

export const useChecklistAndDashboardData = ({
  propertyData,
  crimeScoreQuery,
  epcDebugCanvasRef,
  isEpcDebugModeOn,
  isAuthenticated,
}: UseChecklistAndDashboardDataArgs): UseChecklistAndDashboardDataResult => {
  const queryClient = useQueryClient();
  const propertyId = propertyData?.propertyId;

  const premiumDataQuery = useQuery<GetPremiumStreetDataResponse | null, Error>({
    queryKey: [REACT_QUERY_KEYS.PREMIUM_STREET_DATA, propertyId],
    queryFn: async () => {
      return (
        queryClient.getQueryData<GetPremiumStreetDataResponse | null>([
          REACT_QUERY_KEYS.PREMIUM_STREET_DATA,
          propertyId,
        ]) ?? null
      );
    },
    enabled: !!propertyId && isAuthenticated,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const preprocessedData = usePreprocessedPropertyData({
    propertyData,
    premiumStreetDataQuery: premiumDataQuery,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
  });

  const propertyChecklistData = useMemo(() => {
    if (
      !propertyData ||
      preprocessedData.isPreprocessedDataLoading ||
      preprocessedData.preprocessedDataError
    )
      return [];
    return generatePropertyChecklist(propertyData, crimeScoreQuery, preprocessedData);
  }, [propertyData, crimeScoreQuery, preprocessedData]);

  const [calculationResultState, setCalculationResultState] =
    useState<CalculationResultType | null>(null);

  useEffect(() => {
    if (preprocessedData.isPreprocessedDataLoading || preprocessedData.preprocessedDataError) {
      setCalculationResultState(null);
      return;
    }

    const result = calculateDashboardScores(propertyChecklistData, preprocessedData);
    setCalculationResultState(result);
  }, [preprocessedData]);

  const categoryScores = calculationResultState?.categoryScores ?? {};
  const overallScore = calculationResultState?.overallScore ?? null;
  const dataCoverageScoreData = calculationResultState?.dataCoverageScoreData;

  return {
    propertyChecklistData,
    preprocessedData,
    categoryScores,
    overallScore,
    dataCoverageScoreData,
    premiumDataQuery,
  };
};
