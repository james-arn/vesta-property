import { UK_AVERAGE_BROADBAND_MBPS } from "@/constants/scoreConstants";
import { extractMbpsFromString } from "@/contentScript/utils/propertyScrapeHelpers";
import { calculateListingHistoryDetails } from "@/sidepanel/propertychecklist/helpers";
import { EpcBandResult } from "@/types/epc";
import {
  GetPremiumStreetDataResponse,
  ProcessedPremiumDataStatus,
  ProcessedPremiumStreetData,
} from "@/types/premiumStreetData";
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
import { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { processPremiumStreetData } from "./helpers/premiumDataProcessing";
import { processRestrictiveCovenants } from "./helpers/preProcessedDataHelpers";
import { UseChecklistAndDashboardDataArgs } from "./useChecklistAndDashboardData";
import { useProcessedEpcData } from "./useProcessedEpcData";

type UsePreprocessedPropertyDataArgs = {
  propertyData: UseChecklistAndDashboardDataArgs["propertyData"];
  premiumStreetDataQuery: UseQueryResult<GetPremiumStreetDataResponse | null, Error> | undefined;
  isParentDataLoading: boolean;
  epcDebugCanvasRef: UseChecklistAndDashboardDataArgs["epcDebugCanvasRef"];
  isEpcDebugModeOn: UseChecklistAndDashboardDataArgs["isEpcDebugModeOn"];
};

export const usePreprocessedPropertyData = ({
  propertyData,
  premiumStreetDataQuery,
  isParentDataLoading,
  epcDebugCanvasRef,
  isEpcDebugModeOn,
}: UsePreprocessedPropertyDataArgs): PreprocessedData => {
  const initialEpcData: EpcData | null | undefined = propertyData?.epc;
  const epcUrl: string | null | undefined = initialEpcData?.url;

  const { processedEpcResult, isEpcProcessing, isEpcError, epcError } = useProcessedEpcData({
    initialEpcData,
    epcUrl,
    isParentDataLoading,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
  });

  const askingPrice = useMemo(() => {
    return parseCurrency(propertyData?.salePrice ?? null);
  }, [propertyData?.salePrice]);

  // --- Premium Data Processing ---
  const processedPremiumDataResult = useMemo((): ProcessedPremiumStreetData => {
    const queryData = premiumStreetDataQuery?.data;
    const premiumData = queryData?.premiumData;

    const premiumQueryStatus: ProcessedPremiumDataStatus =
      premiumStreetDataQuery?.status === "pending"
        ? "pending"
        : premiumStreetDataQuery?.status === "error"
          ? "error"
          : premiumStreetDataQuery?.status === "success"
            ? "success"
            : "idle";

    return processPremiumStreetData(premiumData ?? undefined, premiumQueryStatus, askingPrice);
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
      // --- PRIORITY 1: Trust good data from background if available and not an error ---
      // This comes from propertyData.epc, which is updated by the background script's successful processing.
      if (
        initialEpcData?.value &&
        initialEpcData.confidence !== ConfidenceLevels.NONE &&
        !initialEpcData.error
      ) {
        console.log(
          "[usePreprocessedPropertyData] Using initialEpcData directly as it's good:",
          initialEpcData
        );
        const score = mapGradeToScore(initialEpcData.value);
        return {
          finalEpcValue: initialEpcData.value,
          finalEpcConfidence: initialEpcData.confidence || ConfidenceLevels.NONE,
          finalEpcSource: initialEpcData.source || null,
          epcScoreForCalculation: score,
        };
      }

      // --- PRIORITY 2: User-provided override (if initialEpcData wasn't good enough above) ---
      // initialEpcValue and initialEpcConfidence are derived from propertyData.epc at the top of this hook
      if (initialEpcConfidence === ConfidenceLevels.USER_PROVIDED && initialEpcValue) {
        console.log(
          "[usePreprocessedPropertyData] Using USER_PROVIDED initialEpcData:",
          initialEpcData
        );
        const score = mapGradeToScore(initialEpcValue);
        return {
          finalEpcValue: initialEpcValue,
          finalEpcConfidence: ConfidenceLevels.USER_PROVIDED,
          finalEpcSource: EpcDataSourceType.USER_PROVIDED,
          epcScoreForCalculation: score,
        };
      }

      // --- PRIORITY 3: High confidence from initial listing scrape (if not already caught by PRIORITY 1) ---
      // This is mostly for cases where background script might not have run PDF/Image OCR yet.
      // initialEpcValue and initialEpcConfidence are from propertyData.epc
      if (
        initialEpcConfidence === ConfidenceLevels.HIGH &&
        initialEpcValue &&
        !initialEpcData?.error
      ) {
        // Added null check for initialEpcData.error
        console.log(
          "[usePreprocessedPropertyData] Using HIGH confidence initialEpcData from listing:",
          initialEpcData
        );
        const score = mapGradeToScore(initialEpcValue);
        return {
          finalEpcValue: initialEpcValue,
          finalEpcConfidence: ConfidenceLevels.HIGH,
          finalEpcSource: initialEpcData?.source || EpcDataSourceType.LISTING, // Ensure source if only LISTING
          epcScoreForCalculation: score,
        };
      }

      // --- If none of the above apply (e.g. initialEpcData is truly NONE or errored),
      //     THEN rely on the client-side processedEpcResult from useProcessedEpcData hook.
      const automatedResult = processedEpcResult;
      console.log(
        "[usePreprocessedPropertyData] Falling back to automatedResult from useProcessedEpcData:",
        automatedResult
      );

      // --- Handle Loading State for Automated Processing ---
      if (isEpcProcessing || !automatedResult) {
        console.log(
          "[usePreprocessedPropertyData] Automated EPC is loading or result not available yet."
        );
        return {
          finalEpcValue: null,
          finalEpcConfidence: ConfidenceLevels.NONE,
          finalEpcSource: null,
          epcScoreForCalculation: null,
        };
      }

      // --- Handle Error State from Automated Processing ---
      if (isEpcError || automatedResult.error) {
        console.warn(
          "[usePreprocessedPropertyData] Automated EPC processing resulted in an error:",
          automatedResult.error || epcError
        );
        return {
          finalEpcValue: null,
          finalEpcConfidence: ConfidenceLevels.NONE,
          finalEpcSource: automatedResult?.source || null, // Preserve source if available, even on error
          epcScoreForCalculation: null,
        };
      }

      // --- Process Successful Automated Result (from useProcessedEpcData) ---
      console.log(
        "[usePreprocessedPropertyData] Processing successful automatedResult:",
        automatedResult
      );
      const value: string | null = automatedResult?.value ?? null;
      const confidence: Confidence = automatedResult?.confidence ?? ConfidenceLevels.NONE;
      const source: EpcDataSourceType | null = automatedResult?.source ?? null;

      let score: number | null = null;
      if (
        automatedResult?.automatedProcessingResult &&
        "currentBand" in automatedResult.automatedProcessingResult
      ) {
        const bandResult = automatedResult.automatedProcessingResult as EpcBandResult;
        score = bandResult.currentBand?.score ?? null;
        if (score === null && value) {
          // ensure value exists before mapping
          score = mapGradeToScore(value);
        }
      } else if (
        automatedResult?.automatedProcessingResult &&
        "currentEpcRating" in automatedResult.automatedProcessingResult
      ) {
        // Type assertion to help TypeScript understand the structure
        const extractedResult = automatedResult.automatedProcessingResult as {
          currentEpcRating?: string | null;
        };
        if (extractedResult.currentEpcRating) {
          score = mapGradeToScore(extractedResult.currentEpcRating);
        } else if (value) {
          // Fallback to top-level value if currentEpcRating is missing
          score = mapGradeToScore(value);
        }
      } else if (value) {
        // Ensure value exists before mapping
        score = mapGradeToScore(value);
      }

      return {
        finalEpcValue: value,
        finalEpcConfidence: confidence,
        finalEpcSource: source,
        epcScoreForCalculation: score,
      };
    }, [
      initialEpcData, // Added to dependency array
      // initialEpcValue, initialEpcConfidence, initialEpcSource are derived from initialEpcData
      // so they don't need to be separate dependencies if initialEpcData covers their changes.
      processedEpcResult,
      isEpcProcessing,
      isEpcError,
      epcError, // Ensure epcError from the hook is a dependency
      // Removed initialEpcValue, initialEpcConfidence, initialEpcSource from deps as initialEpcData covers them
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
    const initialPublicRoW = propertyData?.publicRightOfWayObligation ?? null;
    const premiumPublicRoW = processedPremiumDataResult?.publicRightOfWayObligation ?? null;

    const finalPublicRoW = premiumPublicRoW ?? initialPublicRoW ?? null;

    const listedProperty =
      premiumStreetDataQuery?.status === "success" && premiumStreetDataQuery?.data?.premiumData
        ? (processedPremiumDataResult?.listedBuildingsOnPlot ?? propertyData?.listedProperty ?? [])
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
      conservationAreaDetails: processedPremiumDataResult.conservationAreaDetails,
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
    processedPremiumDataResult.conservationAreaDetails,
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
