import { CrimeScoreData } from "@/hooks/useCrimeScore";
import { useProcessedEpcData } from "@/hooks/useProcessedEpcData";
import { EpcProcessorResult, INITIAL_EPC_RESULT_STATE } from "@/lib/epcProcessing";
import { calculateRemainingLeaseTerm } from "@/sidepanel/propertychecklist/helpers";
import { generatePropertyChecklist } from "@/sidepanel/propertychecklist/propertyChecklist";
import { PremiumStreetDataResponse } from "@/types/premiumStreetData";
import {
  DashboardScores,
  ExtractedPropertyScrapingData,
  PropertyDataListItem,
} from "@/types/property";
import { calculateDashboardScores, mapEpcToScore } from "@/utils/scoreCalculations";
import { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

interface CalculationData {
  calculatedLeaseMonths: number | null;
  epcScoreForCalculation: number;
}

interface UseChecklistAndDashboardDataArgs {
  propertyData: ExtractedPropertyScrapingData | null;
  crimeScoreQuery: UseQueryResult<CrimeScoreData, Error> | undefined;
  premiumStreetDataQuery: UseQueryResult<PremiumStreetDataResponse, Error> | undefined;
  epcDebugCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isEpcDebugModeOn: boolean;
}

interface UseChecklistAndDashboardDataResult {
  basePropertyChecklistData: PropertyDataListItem[];
  dashboardCalculationData: CalculationData;
  dashboardScores: DashboardScores;
  processedEpcResult: EpcProcessorResult;
}

export const useChecklistAndDashboardData = ({
  propertyData,
  crimeScoreQuery,
  premiumStreetDataQuery,
  epcDebugCanvasRef,
  isEpcDebugModeOn,
}: UseChecklistAndDashboardDataArgs): UseChecklistAndDashboardDataResult => {
  const { processedEpcResult } = useProcessedEpcData({
    initialEpcData: propertyData?.epc,
    epcUrl: propertyData?.epc?.url,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
  });

  // 1. Generate Checklist for UI
  const basePropertyChecklistData = useMemo(() => {
    if (!propertyData) return [];
    return generatePropertyChecklist(
      propertyData,
      crimeScoreQuery,
      premiumStreetDataQuery,
      processedEpcResult ?? INITIAL_EPC_RESULT_STATE
    );
  }, [propertyData, crimeScoreQuery, premiumStreetDataQuery, processedEpcResult]);

  // 2. Prepare Data for Dashboard Calculations
  const dashboardCalculationData = useMemo((): CalculationData => {
    const premiumLeaseDetails =
      premiumStreetDataQuery?.data?.data?.attributes.tenure?.lease_details;
    const premiumLeaseEndDate = premiumLeaseDetails?.calculated_end_of_lease;
    const { totalMonths: calculatedLeaseMonths } = calculateRemainingLeaseTerm(premiumLeaseEndDate);

    const finalEpcValue = processedEpcResult?.value;
    const epcScoreForCalculation = mapEpcToScore(finalEpcValue);

    return {
      calculatedLeaseMonths: calculatedLeaseMonths,
      epcScoreForCalculation: epcScoreForCalculation,
    };
  }, [premiumStreetDataQuery?.data, processedEpcResult]);

  // 3. Calculate Final Dashboard Scores
  const dashboardScores = useMemo(() => {
    // Pass both checklist (for simple lookups) and calc data (for specific values)
    return calculateDashboardScores(basePropertyChecklistData, dashboardCalculationData);
  }, [basePropertyChecklistData, dashboardCalculationData]);

  return {
    basePropertyChecklistData,
    dashboardCalculationData,
    dashboardScores,
    processedEpcResult: processedEpcResult ?? INITIAL_EPC_RESULT_STATE,
  };
};
