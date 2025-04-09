import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { EpcProcessorResult, INITIAL_EPC_RESULT_STATE, processEpcData } from "@/lib/epcProcessing";
import { DataStatus, EpcConfidenceLevels, EpcData } from "@/types/property";
import { useQuery } from "@tanstack/react-query";
import React from "react";

interface UseProcessedEpcDataProps {
  initialEpcData: EpcData | null | undefined;
  epcUrl: string | null | undefined;
  epcDebugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  isEpcDebugModeOn?: boolean;
}

/**
 * Custom hook to manage fetching, processing, and caching of EPC data using TanStack Query.
 *
 * Handles PDF/Image processing via processEpcData and intelligently uses initial data
 * based on confidence levels.
 */
export const useProcessedEpcData = ({
  initialEpcData,
  epcUrl,
  epcDebugCanvasRef,
  isEpcDebugModeOn,
}: UseProcessedEpcDataProps) => {
  const { data, isLoading, isError, error } = useQuery<EpcProcessorResult, Error>({
    queryKey: [REACT_QUERY_KEYS.PROCESSED_EPC, epcUrl],
    queryFn: async () => {
      if (!epcUrl) {
        // Return a default state if URL is missing
        return {
          ...INITIAL_EPC_RESULT_STATE,
          ...(initialEpcData || {}), // Use initial if available
          isLoading: false,
          status: initialEpcData?.value ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT,
        };
      }
      return await processEpcData(epcUrl, isEpcDebugModeOn ? epcDebugCanvasRef : undefined);
    },
    // Only run processing if URL exists AND initial confidence is NONE
    enabled: !!epcUrl && initialEpcData?.confidence === EpcConfidenceLevels.NONE,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30, // Cache for 30 mins after inactive
    initialData: () => {
      // Provide scraped data as initial if confidence is NOT NONE
      if (initialEpcData && initialEpcData.confidence !== EpcConfidenceLevels.NONE) {
        return {
          ...INITIAL_EPC_RESULT_STATE,
          ...initialEpcData,
          isLoading: false, // Not loading, it's initial data
          status: initialEpcData.value ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT,
        };
      }
      return undefined; // Let TanStack Query handle loading state if confidence IS NONE
    },
  });

  // Return the results from useQuery
  // The component using this hook will get the data, loading state, etc.
  return {
    processedEpcResult: data, // Rename for clarity in the consuming component
    isEpcProcessing: isLoading,
    isEpcError: isError,
    epcError: error,
  };
};
