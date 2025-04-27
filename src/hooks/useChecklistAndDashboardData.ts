import { CrimeScoreData } from "@/hooks/useCrimeScore";
import { generatePropertyChecklist } from "@/sidepanel/propertychecklist/propertyChecklist";
import { PremiumStreetDataResponse } from "@/types/premiumStreetData";
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
import { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  preprocessedData: PreprocessedData;
  categoryScores: DashboardScores;
  overallScore: number | null;
  dataCoverageScoreData: CategoryScoreData | undefined;
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
  };
};
