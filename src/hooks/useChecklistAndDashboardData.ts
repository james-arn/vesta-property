import { CrimeScoreData } from "@/hooks/useCrimeScore";
import { useProcessedEpcData } from "@/hooks/useProcessedEpcData";
import { EpcProcessorResult, INITIAL_EPC_RESULT_STATE } from "@/lib/epcProcessing";
import { generatePropertyChecklist } from "@/sidepanel/propertychecklist/propertyChecklist";
import { PremiumStreetDataResponse, ProcessedPremiumStreetData } from "@/types/premiumStreetData";
import {
  DashboardScores,
  ExtractedPropertyScrapingData,
  PropertyDataListItem,
} from "@/types/property";
import { calculateDashboardScores, mapEpcToScore } from "@/utils/scoreCalculations";
import { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { processPremiumStreetData } from "./helpers/premiumDataProcessing";

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
  processedPremiumData: ProcessedPremiumStreetData;
}

export const useChecklistAndDashboardData = ({
  propertyData,
  crimeScoreQuery,
  premiumStreetDataQuery,
  epcDebugCanvasRef,
  isEpcDebugModeOn,
}: UseChecklistAndDashboardDataArgs): UseChecklistAndDashboardDataResult => {
  // 1. preProccess data where required before generating checklist and dashboard
  const { processedEpcResult } = useProcessedEpcData({
    initialEpcData: propertyData?.epc,
    epcUrl: propertyData?.epc?.url,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
  });

  const processedPremiumData = useMemo(() => {
    return processPremiumStreetData(
      premiumStreetDataQuery?.data,
      premiumStreetDataQuery?.status ?? "idle" // Provide default status if query undefined
    );
  }, [premiumStreetDataQuery?.data, premiumStreetDataQuery?.status]);

  // 2. Generate Checklist for UI
  const basePropertyChecklistData = useMemo(() => {
    if (!propertyData) return [];
    return generatePropertyChecklist(
      propertyData,
      crimeScoreQuery,
      processedPremiumData, // Pass processed data
      processedEpcResult ?? INITIAL_EPC_RESULT_STATE
    );
  }, [propertyData, crimeScoreQuery, processedPremiumData, processedEpcResult]);

  // 3. Prepare Data for Dashboard Calculations
  const dashboardCalculationData = useMemo((): CalculationData => {
    // Use processed data for lease term calculation
    const calculatedLeaseMonths = processedPremiumData.premiumLeaseTotalMonths;

    const finalEpcValue = processedEpcResult?.value;
    const epcScoreForCalculation = mapEpcToScore(finalEpcValue);

    return {
      calculatedLeaseMonths: calculatedLeaseMonths,
      epcScoreForCalculation: epcScoreForCalculation,
    };
  }, [processedPremiumData.premiumLeaseTotalMonths, processedEpcResult]);

  // 4. Calculate Final Dashboard Scores
  const dashboardScores = useMemo(() => {
    // Pass both checklist (for simple lookups) and calc data (for specific values)
    return calculateDashboardScores(basePropertyChecklistData, dashboardCalculationData);
  }, [basePropertyChecklistData, dashboardCalculationData]);

  return {
    basePropertyChecklistData,
    dashboardCalculationData,
    dashboardScores,
    processedEpcResult: processedEpcResult ?? INITIAL_EPC_RESULT_STATE,
    processedPremiumData,
  };
};
