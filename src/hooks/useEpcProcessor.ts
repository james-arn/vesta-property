import { ActionEvents } from "@/constants/actionEvents";
import { EpcBandResult, processEpcImageDataUrl } from "@/sidepanel/propertychecklist/epcImageUtils";
import { DataStatus } from "@/types/property";
import { formatEPCBandInfo } from "@/utils/formatting";
import { useEffect, useRef, useState } from "react";

export type EpcProcessingState = {
  status: DataStatus;
  displayValue: string;
  imageDataUrl: string | null;
  isLoading: boolean;
  error: string | null;
  epcResult: EpcBandResult | null; // Expose raw result if needed elsewhere
};

const INITIAL_STATE: EpcProcessingState = {
  status: DataStatus.IS_LOADING, // Default to loading if URL is provided initially
  displayValue: "Loading...",
  imageDataUrl: null,
  isLoading: false,
  error: null,
  epcResult: null,
};

export const useEpcProcessor = (
  originalImageUrl: string | null | undefined,
  initialValue: string | number | boolean | undefined | null, // Keep original value if no URL
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null> // Optional ref for debugging
): EpcProcessingState => {
  const [processingState, setProcessingState] = useState<EpcProcessingState>(INITIAL_STATE);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!originalImageUrl || !originalImageUrl.startsWith("http")) {
      // Reset to idle/initial state if no valid URL
      setProcessingState({
        status: DataStatus.NOT_APPLICABLE, // Or determine based on initialValue
        displayValue: String(initialValue ?? "N/A"),
        imageDataUrl: null,
        isLoading: false,
        error: null,
        epcResult: null,
      });
      return;
    }

    // Start fetching
    setProcessingState((prevState) => ({
      ...prevState,
      isLoading: true,
      status: DataStatus.IS_LOADING,
      displayValue: "Fetching image...",
      error: null,
      epcResult: null,
      imageDataUrl: null,
    }));
    console.log(`[useEpcProcessor] Requesting fetch for: ${originalImageUrl}`);

    chrome.runtime.sendMessage(
      { action: ActionEvents.FETCH_IMAGE_FOR_CANVAS, url: originalImageUrl },
      (response) => {
        if (!isMountedRef.current) {
          console.log(
            "[useEpcProcessor] Component unmounted or URL changed before background response processed."
          );
          return; // Avoid state updates if unmounted or URL changed
        }

        if (response?.success && response.dataUrl) {
          const fetchedDataUrl = response.dataUrl;
          setProcessingState((prevState) => ({
            ...prevState,
            status: DataStatus.IS_LOADING,
            displayValue: "Analysing image...",
            imageDataUrl: fetchedDataUrl,
          }));
          console.log(
            `[useEpcProcessor] Received Data URL (first 100 chars):`,
            fetchedDataUrl.substring(0, 100)
          );
          console.log(`[useEpcProcessor] Attempting to process Data URL for canvas.`);

          processEpcImageDataUrl(fetchedDataUrl, debugCanvasRef?.current)
            .then((result) => {
              if (isMountedRef.current) {
                const hasBands = result.currentBand || result.potentialBand;
                const newStatus = result.error
                  ? DataStatus.ASK_AGENT
                  : hasBands
                    ? DataStatus.FOUND_POSITIVE
                    : DataStatus.ASK_AGENT;
                let newValue = "Could not determine bands from image.";
                if (result.error) {
                  newValue = `Error: ${result.error}`;
                } else if (hasBands) {
                  newValue = `Current: ${formatEPCBandInfo(result.currentBand)} | Potential: ${formatEPCBandInfo(result.potentialBand)}`;
                }

                setProcessingState({
                  status: newStatus,
                  displayValue: newValue,
                  imageDataUrl: fetchedDataUrl, // Keep data URL on success/failure
                  isLoading: false,
                  error: result.error || (hasBands ? null : "Could not determine bands"),
                  epcResult: result,
                });
              }
            })
            .catch((error) => {
              console.error(`[useEpcProcessor] Canvas processing failed:`, error);
              if (isMountedRef.current) {
                const errorMsg = error?.message || "Canvas processing failed.";
                setProcessingState({
                  status: DataStatus.ASK_AGENT,
                  displayValue: `Error: ${errorMsg}`,
                  imageDataUrl: fetchedDataUrl, // Keep data URL even on canvas error
                  isLoading: false,
                  error: errorMsg,
                  epcResult: { error: errorMsg },
                });
              }
            });
        } else {
          const errorMsg = response?.error || "Failed to fetch image data.";
          console.error(`[useEpcProcessor] Background fetch failed:`, errorMsg);
          if (isMountedRef.current) {
            setProcessingState({
              status: DataStatus.ASK_AGENT,
              displayValue: `Error: ${errorMsg}`,
              imageDataUrl: null, // No data URL if fetch failed
              isLoading: false,
              error: errorMsg,
              epcResult: { error: errorMsg },
            });
          }
        }
      }
    );
  }, [originalImageUrl, initialValue, debugCanvasRef]); // Rerun if URL changes

  // Combine loading state into the main status for simplicity if needed by consumer
  const finalStatus = processingState.isLoading ? DataStatus.IS_LOADING : processingState.status;

  return {
    ...processingState,
    status: finalStatus, // Return IS_LOADING if actively processing
  };
};
