import { UK_AVERAGE_BROADBAND_MBPS } from "@/constants/scoreConstants";
import { extractMbpsFromString } from "@/contentScript/utils/propertyScrapeHelpers";
import { calculateListingHistoryDetails } from "@/sidepanel/propertychecklist/helpers";
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
import { parseCurrency } from "@/utils/parsingHelpers";
import { calculateNearbySchoolsScoreValue } from "@/utils/scoreCalculations/helpers/connectivityProcessingHelpers";
import { mapGradeToScore } from "@/utils/scoreCalculations/scoreCalculationHelpers";
import { getStatusFromString } from "@/utils/statusHelpers";
import { useMemo } from "react";
import { processPremiumStreetData } from "./helpers/premiumDataProcessing";
import { processRestrictiveCovenants } from "./helpers/preProcessedDataHelpers";
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

  const askingPrice = useMemo(() => {
    return parseCurrency(propertyData?.salePrice ?? null);
  }, [propertyData?.salePrice]);

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

    return processPremiumStreetData(premiumStreetDataQuery?.data, premiumQueryStatus, askingPrice);
  }, [premiumStreetDataQuery?.data, premiumStreetDataQuery?.status, askingPrice]);

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
  const initialEpcValue = propertyData?.epc?.value;
  const initialEpcConfidence = propertyData?.epc?.confidence;
  const initialEpcSource = propertyData?.epc?.source;

  const { finalEpcValue, finalEpcConfidence, finalEpcSource, epcScoreForCalculation } =
    useMemo(() => {
      // --- Prioritize User Override ---
      if (initialEpcConfidence === ConfidenceLevels.USER_PROVIDED && initialEpcValue) {
        const score = mapGradeToScore(initialEpcValue);
        return {
          finalEpcValue: initialEpcValue,
          finalEpcConfidence: ConfidenceLevels.USER_PROVIDED,
          finalEpcSource: initialEpcSource ?? EpcDataSourceType.NONE,
          epcScoreForCalculation: score,
        };
      }

      // --- If no user override, proceed with automated processing result ---
      const automatedResult = processedEpcResult;

      // --- Handle Loading State ---
      if (isEpcProcessing || !automatedResult) {
        return {
          finalEpcValue: null,
          finalEpcConfidence: ConfidenceLevels.NONE,
          finalEpcSource: null,
          epcScoreForCalculation: null,
        };
      }

      // --- Handle Error State ---
      if (isEpcError || automatedResult.error) {
        return {
          finalEpcValue: null,
          finalEpcConfidence: ConfidenceLevels.NONE,
          finalEpcSource: null,
          epcScoreForCalculation: null,
        };
      }

      // --- Process Successful Automated Result ---
      const value: string | null = automatedResult?.value ?? null;
      const confidence: Confidence = automatedResult?.confidence ?? ConfidenceLevels.NONE;
      const source: EpcDataSourceType | null = automatedResult?.source ?? null;

      // Determine the score, preferring the score calculated during processing if available
      let score: number | null = null;
      if (
        automatedResult?.automatedProcessingResult &&
        "currentBand" in automatedResult.automatedProcessingResult
      ) {
        const bandResult = automatedResult.automatedProcessingResult as EpcBandResult;
        score = bandResult.currentBand?.score ?? null;
        if (score === null) {
          console.warn(
            "EPC BandResult found, but currentBand.score was null. Falling back to grade mapping for:",
            value
          );
          score = mapGradeToScore(value);
        }
      } else if (
        automatedResult?.automatedProcessingResult &&
        "currentEpcRating" in automatedResult.automatedProcessingResult
      ) {
        const extractedResult = automatedResult.automatedProcessingResult;
        score = mapGradeToScore(extractedResult.currentEpcRating);
      } else {
        score = mapGradeToScore(value);
      }

      return {
        finalEpcValue: value,
        finalEpcConfidence: confidence,
        finalEpcSource: source,
        epcScoreForCalculation: score,
      };
    }, [
      initialEpcValue,
      initialEpcConfidence,
      initialEpcSource,
      processedEpcResult,
      isEpcProcessing,
      isEpcError,
    ]);

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

  // --- Listing History Processing ---
  const {
    status: listingHistoryStatus,
    value: listingHistoryDisplayValue,
    daysOnMarket: listingDaysOnMarket,
  } = useMemo(() => {
    return calculateListingHistoryDetails(propertyData?.listingHistory ?? null);
  }, [propertyData?.listingHistory]);

  const miningImpactStatus = propertyData?.miningImpactStatus;

  const preprocessedData: PreprocessedData = useMemo(() => {
    // Start with the data from the initial scrape (which is now RightOfWayDetails | null)
    const initialPublicRoW = propertyData?.publicRightOfWayObligation ?? null;

    // Check if premium data provides more detail
    const premiumPublicRoW = processedPremiumDataResult?.publicRightOfWayObligation ?? null;

    const finalPublicRoW = premiumPublicRoW ?? initialPublicRoW ?? null;

    const listedProperty =
      premiumStreetDataQuery?.status === "success"
        ? (processedPremiumDataResult?.listedBuildingsOnPlot ?? propertyData?.listedProperty ?? []) // empty array if no listed buildings on plot
        : (propertyData?.listedProperty ?? null);

    const restrictiveCovenants = processRestrictiveCovenants(
      premiumStreetDataQuery?.status ?? "idle",
      processedPremiumDataResult?.restrictiveCovenants,
      propertyData?.restrictions
    );

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
      privateRightOfWayObligation: propertyData?.privateRightOfWayObligation ?? null,
      publicRightOfWayObligation: finalPublicRoW,
      listingHistoryStatus,
      listingHistoryDisplayValue,
      listingDaysOnMarket,
      listedProperty,
      restrictiveCovenants,
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
    listingHistoryStatus,
    listingHistoryDisplayValue,
    listingDaysOnMarket,
    propertyData?.privateRightOfWayObligation,
    propertyData?.publicRightOfWayObligation,
    propertyData?.listedProperty,
    propertyData?.restrictions,
    premiumStreetDataQuery?.status,
    processedPremiumDataResult?.restrictiveCovenants,
  ]);

  return preprocessedData;
};
