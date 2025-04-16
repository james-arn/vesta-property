import { UK_AVERAGE_BROADBAND_MBPS } from "@/constants/scoreConstants";
import { extractMbpsFromString } from "@/contentScript/utils/propertyScrapeHelpers";
import { EpcBandResult } from "@/types/epc";
import { ProcessedPremiumDataStatus, ProcessedPremiumStreetData } from "@/types/premiumStreetData";
import {
  Confidence,
  ConfidenceLevels,
  DataStatus,
  EpcData,
  EpcDataSourceType,
  PreprocessedData,
} from "@/types/property";
import { calculateNearbySchoolsScoreValue } from "@/utils/scoreCalculations/helpers/connectivityProcessingHelpers";
import { mapGradeToScore } from "@/utils/scoreCalculations/scoreCalculationHelpers";
import { getStatusFromString } from "@/utils/statusHelpers";
import { useMemo } from "react";
import { processPremiumStreetData } from "./helpers/premiumDataProcessing";
import { UseChecklistAndDashboardDataArgs } from "./useChecklistAndDashboardData";
import { useProcessedEpcData } from "./useProcessedEpcData";

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

  const nearbySchoolsScoreValue = useMemo(() => {
    return calculateNearbySchoolsScoreValue(propertyData?.nearbySchools);
  }, [propertyData?.nearbySchools]);

  const { broadbandScoreValue, broadbandDisplayValue, broadbandStatus } = useMemo(() => {
    const rawBroadbandValue = propertyData?.broadband;
    const speedMbps = extractMbpsFromString(rawBroadbandValue ?? null);
    const displayValue = rawBroadbandValue ?? null;
    let scoreValue: number | null = 0;
    let status: DataStatus | null = DataStatus.ASK_AGENT;

    if (speedMbps === null) {
      status = getStatusFromString(rawBroadbandValue ?? null);
    } else {
      const percentageOfAverage = (speedMbps / UK_AVERAGE_BROADBAND_MBPS) * 100;

      if (percentageOfAverage < 50) {
        scoreValue = 20;
        status = DataStatus.FOUND_NEGATIVE;
      } else if (percentageOfAverage <= 90) {
        scoreValue = 40;
        status = DataStatus.FOUND_POSITIVE;
      } else if (percentageOfAverage <= 150) {
        scoreValue = 75;
        status = DataStatus.FOUND_POSITIVE;
      } else if (percentageOfAverage <= 500) {
        scoreValue = 90;
        status = DataStatus.FOUND_POSITIVE;
      } else {
        scoreValue = 100;
        status = DataStatus.FOUND_POSITIVE;
      }

      const initialStatus = getStatusFromString(rawBroadbandValue ?? null);
      if (initialStatus === DataStatus.ASK_AGENT) {
        status = DataStatus.ASK_AGENT;
      }
    }

    return {
      broadbandScoreValue: scoreValue,
      broadbandDisplayValue: displayValue,
      broadbandStatus: status,
    };
  }, [propertyData?.broadband]);

  const miningImpactStatus = propertyData?.miningImpactStatus;

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
      nearbySchoolsScoreValue,
      broadbandScoreValue,
      broadbandDisplayValue,
      broadbandStatus,
      miningImpactStatus: miningImpactStatus ?? null,
      conservationAreaDetails: processedPremiumDataResult?.conservationAreaDetails ?? null,
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
    nearbySchoolsScoreValue,
    broadbandScoreValue,
    broadbandDisplayValue,
    broadbandStatus,
    miningImpactStatus,
    processedPremiumDataResult?.conservationAreaDetails,
  ]);

  return preprocessedData;
};
