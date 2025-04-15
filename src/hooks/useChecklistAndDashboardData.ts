import { CrimeScoreData } from "@/hooks/useCrimeScore";
import { generatePropertyChecklist } from "@/sidepanel/propertychecklist/propertyChecklist";
import { PremiumStreetDataResponse } from "@/types/premiumStreetData";
import {
  DashboardScores,
  ExtractedPropertyScrapingData,
  PreprocessedData,
  PropertyDataListItem,
} from "@/types/property";
import { calculateDashboardScores } from "@/utils/scoreCalculations";
import { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePreprocessedPropertyData } from "./usePreprocessedPropertyData";

export interface UseChecklistAndDashboardDataArgs {
  propertyData: ExtractedPropertyScrapingData | null;
  crimeScoreQuery: UseQueryResult<CrimeScoreData, Error> | undefined;
  premiumStreetDataQuery: UseQueryResult<PremiumStreetDataResponse, Error> | undefined;
  epcDebugCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isEpcDebugModeOn: boolean;
}

export interface UseChecklistAndDashboardDataResult {
  propertyChecklistData: PropertyDataListItem[];
  dashboardScores: DashboardScores | undefined;
  preprocessedData: PreprocessedData;
}

export const useChecklistAndDashboardData = ({
  propertyData,
  crimeScoreQuery,
  premiumStreetDataQuery,
  epcDebugCanvasRef,
  isEpcDebugModeOn,
}: UseChecklistAndDashboardDataArgs): UseChecklistAndDashboardDataResult => {
  const preprocessedData = usePreprocessedPropertyData({
    propertyData,
    premiumStreetDataQuery,
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

  const dashboardScores = useMemo(() => {
    if (preprocessedData.isPreprocessedDataLoading || preprocessedData.preprocessedDataError)
      return undefined;
    return calculateDashboardScores(propertyChecklistData, preprocessedData);
  }, [propertyChecklistData, preprocessedData]);

  return {
    propertyChecklistData,
    dashboardScores,
    preprocessedData,
  };
};
