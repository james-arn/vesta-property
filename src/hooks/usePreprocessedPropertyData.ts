import { UK_AVERAGE_BROADBAND_MBPS } from "@/constants/scoreConstants";
import { extractMbpsFromString } from "@/contentScript/utils/propertyScrapeHelpers";
import { EpcBandResult } from "@/sidepanel/propertychecklist/Epc/epcImageUtils";
import { calculateListingHistoryDetails } from "@/sidepanel/propertychecklist/helpers";
import {
  GetPremiumStreetDataResponse,
  ProcessedPremiumDataStatus,
  ProcessedPremiumStreetData,
} from "@/types/premiumStreetData";
import {
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

type UsePreprocessedPropertyDataArgs = {
  propertyData: UseChecklistAndDashboardDataArgs["propertyData"];
  premiumStreetDataQuery: UseQueryResult<GetPremiumStreetDataResponse | null, Error> | undefined;
  isParentDataLoading: boolean;
};

export const usePreprocessedPropertyData = ({
  propertyData,
  premiumStreetDataQuery,
  isParentDataLoading,
}: UsePreprocessedPropertyDataArgs): PreprocessedData => {
  const initialEpcData: EpcData | null | undefined = propertyData?.epc;

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

  const isPreprocessedDataLoading = isParentDataLoading || isPremiumLoading;
  const epcErrorFromInitialData = initialEpcData?.error
    ? new Error(String(initialEpcData.error))
    : null;
  const preprocessedDataError = epcErrorFromInitialData || premiumError;

  // --- Determine Final EPC Values ---
  const { finalEpcValue, finalEpcConfidence, finalEpcSource, epcScoreForCalculation } =
    useMemo(() => {
      // Combined loading check for parent data or premium data query
      if (isParentDataLoading) {
        return {
          finalEpcValue: null,
          finalEpcConfidence: ConfidenceLevels.NONE,
          finalEpcSource: null,
          epcScoreForCalculation: null,
        };
      }

      const premiumEnergyPerformance =
        premiumStreetDataQuery?.data?.premiumData?.data?.attributes?.energy_performance;

      // PRIORITY 1: Premium Data EPC
      if (premiumEnergyPerformance?.energy_efficiency?.current_rating) {
        const premiumEpcValue = premiumEnergyPerformance.energy_efficiency.current_rating;
        let premiumConfidence: (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels] =
          ConfidenceLevels.MEDIUM;
        if (premiumEnergyPerformance.meta?.data_type === "actual") {
          premiumConfidence = ConfidenceLevels.HIGH;
        }
        // Ensure the value is a valid EPC rating (single uppercase letter A-G)
        if (premiumEpcValue && /^[A-G]$/.test(premiumEpcValue.toUpperCase())) {
          console.log(
            "[usePreprocessedPropertyData] Using Premium EPC data:",
            premiumEnergyPerformance
          );
          const score = mapGradeToScore(premiumEpcValue.toUpperCase());
          return {
            finalEpcValue: premiumEpcValue.toUpperCase(),
            finalEpcConfidence: premiumConfidence,
            finalEpcSource: EpcDataSourceType.PREMIUM_API,
            epcScoreForCalculation: score,
          };
        }
      }

      // PRIORITY 2: User-Provided EPC (from initialEpcData, which is propertyData.epc)
      if (
        initialEpcData?.confidence === ConfidenceLevels.USER_PROVIDED &&
        initialEpcData?.value &&
        !initialEpcData.error
      ) {
        console.log("[usePreprocessedPropertyData] Using User Provided EPC data:", initialEpcData);
        const score = mapGradeToScore(initialEpcData.value);
        return {
          finalEpcValue: initialEpcData.value,
          finalEpcConfidence: initialEpcData.confidence,
          finalEpcSource: initialEpcData.source, // Should be EpcDataSourceType.USER_PROVIDED
          epcScoreForCalculation: score,
        };
      }

      // PRIORITY 3: Background Processed EPC (from initialEpcData, after UI/Premium checks)
      // Handle error from initialEpcData (background processing error)
      if (initialEpcData?.error) {
        console.warn(
          "[usePreprocessedPropertyData] Error in initialEpcData (background processed): ",
          initialEpcData.error
        );
        return {
          finalEpcValue: null,
          finalEpcConfidence: initialEpcData.confidence || ConfidenceLevels.NONE, // Keep confidence if available
          finalEpcSource: initialEpcData.source || null, // Keep source if available
          epcScoreForCalculation: null,
        };
      }

      // Use other initialEpcData if value and confidence are good (e.g., GOV_EPC_CONFIRMED, OCR result, HIGH from scrape)
      if (initialEpcData?.value && initialEpcData.confidence !== ConfidenceLevels.NONE) {
        console.log(
          "[usePreprocessedPropertyData] Using background processed/scraped EPC data:",
          initialEpcData
        );
        const score = mapGradeToScore(initialEpcData.value);
        return {
          finalEpcValue: initialEpcData.value,
          finalEpcConfidence: initialEpcData.confidence,
          finalEpcSource: initialEpcData.source,
          epcScoreForCalculation: score,
        };
      }

      // Default/Fallback: No definitive EPC data, or low confidence scrape
      console.log(
        "[usePreprocessedPropertyData] No definitive EPC. Using fallback based on initialEpcData:",
        initialEpcData
      );
      return {
        finalEpcValue: initialEpcData?.value || null,
        finalEpcConfidence: initialEpcData?.confidence || ConfidenceLevels.NONE,
        finalEpcSource: initialEpcData?.source || null,
        epcScoreForCalculation: initialEpcData?.value
          ? mapGradeToScore(initialEpcData.value)
          : null,
      };
    }, [
      initialEpcData,
      isParentDataLoading,
      processedPremiumDataResult, // Still a dependency, in case other parts of it are used or premium EPC is re-added
      premiumStreetDataQuery?.status,
      premiumStreetDataQuery?.data?.premiumData?.data?.attributes?.energy_performance, // Corrected path
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

    const automatedProcessingResultFromInitial = initialEpcData?.automatedProcessingResult;
    const derivedFinalEpcBandData =
      automatedProcessingResultFromInitial && "currentBand" in automatedProcessingResultFromInitial
        ? (automatedProcessingResultFromInitial as EpcBandResult)
        : undefined;

    return {
      isPreprocessedDataLoading,
      preprocessedDataError,
      finalEpcBandData: derivedFinalEpcBandData,
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
      initialEpcData,
      rawFloodDefences: propertyData?.floodDefences ?? null,
      rawFloodSources: propertyData?.floodSources ?? null,
      rawFloodedInLastFiveYears: propertyData?.floodedInLastFiveYears ?? null,
    };
  }, [
    isPreprocessedDataLoading,
    preprocessedDataError,
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
    initialEpcData,
    propertyData?.floodDefences,
    propertyData?.floodSources,
    propertyData?.floodedInLastFiveYears,
  ]);

  return preprocessedData;
};
