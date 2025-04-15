import { EpcBandResult } from "@/types/epc";
import { ProcessedPremiumDataStatus, ProcessedPremiumStreetData } from "@/types/premiumStreetData";
import {
  Confidence,
  ConfidenceLevels,
  EpcData,
  EpcDataSourceType,
  PreprocessedData,
} from "@/types/property";
import { mapGradeToScore } from "@/utils/scoreCalculations/scoreCalculationHelpers";
import { useMemo } from "react";
import { processPremiumStreetData } from "./helpers/premiumDataProcessing";
import { UseChecklistAndDashboardDataArgs } from "./useChecklistAndDashboardData";
import { useProcessedEpcData } from "./useProcessedEpcData";

// Type for the arguments specifically needed by this hook
type UsePreprocessedPropertyDataArgs = Pick<
  UseChecklistAndDashboardDataArgs,
  "propertyData" | "premiumStreetDataQuery" | "epcDebugCanvasRef" | "isEpcDebugModeOn"
>;

export const usePreprocessedPropertyData = ({
  propertyData,
  premiumStreetDataQuery,
  epcDebugCanvasRef,
  isEpcDebugModeOn,
}: UsePreprocessedPropertyDataArgs): PreprocessedData => {
  const initialEpcData: EpcData | null | undefined = propertyData?.epc;
  const epcUrl: string | null | undefined = initialEpcData?.url;

  const { processedEpcResult, isEpcProcessing, isEpcError, epcError } = useProcessedEpcData({
    initialEpcData,
    epcUrl,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
  });

  // --- Premium Data Processing ---
  const processedPremiumDataResult = useMemo((): ProcessedPremiumStreetData => {
    const premiumQueryStatus: ProcessedPremiumDataStatus =
      premiumStreetDataQuery?.status === "pending"
        ? "pending"
        : premiumStreetDataQuery?.status === "error"
          ? "error"
          : premiumStreetDataQuery?.status === "success"
            ? "success"
            : "idle";

    return processPremiumStreetData(premiumStreetDataQuery?.data, premiumQueryStatus);
  }, [premiumStreetDataQuery?.data, premiumStreetDataQuery?.status]);

  const calculatedLeaseMonths = useMemo(
    () => processedPremiumDataResult.premiumLeaseTotalMonths,
    [processedPremiumDataResult.premiumLeaseTotalMonths]
  );

  // --- Combine Loading and Error States ---
  const isPremiumLoading = premiumStreetDataQuery?.fetchStatus === "fetching";
  const premiumError =
    premiumStreetDataQuery?.error instanceof Error ? premiumStreetDataQuery.error : null;

  const isPreprocessedDataLoading = isEpcProcessing || isPremiumLoading;
  const preprocessedDataError = (epcError as Error | null) || premiumError;

  // --- Determine Final EPC Values ---
  const { finalEpcValue, finalEpcConfidence, finalEpcSource, epcScoreForCalculation } =
    useMemo(() => {
      const currentEpcResult = processedEpcResult;
      const userProvidedValue: string | null | undefined = initialEpcData?.value;
      const userProvidedConfidence: Confidence | undefined = initialEpcData?.confidence;

      if (isEpcProcessing || !currentEpcResult) {
        return {
          finalEpcValue: null,
          finalEpcConfidence: initialEpcData?.confidence ?? ConfidenceLevels.NONE,
          finalEpcSource: initialEpcData?.source ?? null,
          epcScoreForCalculation: null,
        };
      }

      if (isEpcError || currentEpcResult.error) {
        return {
          finalEpcValue: null,
          finalEpcConfidence: ConfidenceLevels.NONE,
          finalEpcSource: null,
          epcScoreForCalculation: null,
        };
      }

      const shouldUseUserValue: boolean =
        (userProvidedConfidence === ConfidenceLevels.USER_PROVIDED && !!userProvidedValue) ||
        (currentEpcResult &&
          currentEpcResult.confidence !== ConfidenceLevels.HIGH &&
          !!userProvidedValue);

      const value: string | null = shouldUseUserValue
        ? userProvidedValue!
        : (currentEpcResult?.value ?? null);
      const confidence: Confidence = shouldUseUserValue
        ? ConfidenceLevels.USER_PROVIDED
        : (currentEpcResult?.confidence ?? ConfidenceLevels.NONE);
      const source: EpcDataSourceType | null = shouldUseUserValue
        ? (initialEpcData?.source ?? null)
        : (currentEpcResult?.source ?? null);

      let score: number | null = null;
      if (shouldUseUserValue) {
        score = mapGradeToScore(userProvidedValue ?? null);
      } else if (currentEpcResult?.scores && "currentBand" in currentEpcResult.scores) {
        const bandResult = currentEpcResult.scores as EpcBandResult;
        score = bandResult.currentBand?.score ?? null;
        if (score === null) {
          console.warn(
            "EPC BandResult found, but currentBand.score was null. Falling back to grade mapping for:",
            value
          );
          score = mapGradeToScore(value);
        }
      } else if (currentEpcResult?.scores && "currentEpcRating" in currentEpcResult.scores) {
        const extractedResult = currentEpcResult.scores;
        score = mapGradeToScore(extractedResult.currentEpcRating);
      } else {
        score = mapGradeToScore(currentEpcResult?.value ?? null);
      }

      return {
        finalEpcValue: value,
        finalEpcConfidence: confidence,
        finalEpcSource: source,
        epcScoreForCalculation: score,
      };
    }, [processedEpcResult, initialEpcData, isEpcProcessing, isEpcError]);

  // --- Construct the Final Preprocessed Data Object ---
  const preprocessedData: PreprocessedData = useMemo(() => {
    return {
      isPreprocessedDataLoading,
      preprocessedDataError,
      processedEpcResult: processedEpcResult ?? null,
      processedPremiumData: processedPremiumDataResult,
      finalEpcValue,
      finalEpcConfidence,
      finalEpcSource,
      epcScoreForCalculation,
      calculatedLeaseMonths,
    };
  }, [
    isPreprocessedDataLoading,
    preprocessedDataError,
    processedEpcResult,
    processedPremiumDataResult,
    finalEpcValue,
    finalEpcConfidence,
    finalEpcSource,
    epcScoreForCalculation,
    calculatedLeaseMonths,
  ]);

  return preprocessedData;
};
