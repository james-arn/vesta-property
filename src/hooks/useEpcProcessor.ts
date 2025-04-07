import { ActionEvents } from "@/constants/actionEvents";
import { EpcBandResult, processEpcImageDataUrl } from "@/sidepanel/propertychecklist/epcImageUtils";
import { DataStatus } from "@/types/property";
import { formatEPCBandInfo } from "@/utils/formatting";
import {
  type ExtractedEpcData,
  extractDataFromText,
  renderPdfPageToDataUrl,
} from "@/utils/pdfProcessingUtils";
import { logErrorToSentry } from "@/utils/sentry";
import { useEffect, useRef, useState } from "react";

type EpcDataSource =
  | { type: "image"; url: string; result: EpcBandResult | null }
  | { type: "pdf"; data: ExtractedEpcData };

interface PerformOcrRequestData {
  imageDataUrl: string;
}

interface PerformOcrResponseData {
  success: boolean;
  text?: string;
  error?: string;
}

export type EpcProcessingState = {
  status: DataStatus;
  displayValue: string; // Generated based on the source
  isLoading: boolean;
  error: string | null;
  epcDataSource: EpcDataSource | null; // Unified data source
};

const INITIAL_STATE: EpcProcessingState = {
  status: DataStatus.IS_LOADING,
  displayValue: "Loading...",
  isLoading: false,
  error: null,
  epcDataSource: null, // Initialize new state field
};

// Constant for sandbox path
const SANDBOX_HTML_PATH = "sandbox.html";

export const useEpcProcessor = (
  originalImageUrl: string | null | undefined,
  initialValue: string | number | boolean | undefined | null,
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>
): EpcProcessingState => {
  const [processingState, setProcessingState] = useState<EpcProcessingState>(INITIAL_STATE);
  const isMountedRef = useRef(true);
  // Store pending OCR request callback (unique ID mapped to callback)
  const ocrCallbackRef = useRef<((result: PerformOcrResponseData) => void) | null>(null);
  const ocrRequestIdRef = useRef<string | null>(null);
  const sandboxIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Cleanup iframe and listener on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const iframe = sandboxIframeRef.current; // Capture ref value

    // Listener for results FROM sandbox
    const handleSandboxMessage = (message: MessageEvent) => {
      // Define expected message structure for type safety
      interface SandboxResultMessage {
        source: "sandbox";
        action: "OCR_RESULT";
        requestId?: string; // Use the correct key name
        data: PerformOcrResponseData;
      }

      const messageData = message.data as SandboxResultMessage;

      if (!messageData || messageData.source !== "sandbox" || messageData.action !== "OCR_RESULT") {
        return;
      }
      console.log("[useEpcProcessor] Received OCR_RESULT from sandbox:", messageData);

      // Check if this result matches the pending request using the correct key name
      if (ocrRequestIdRef.current && messageData.requestId === ocrRequestIdRef.current) {
        if (ocrCallbackRef.current) {
          ocrCallbackRef.current(messageData.data); // Pass only the data part
        }
        // Clear pending request
        ocrCallbackRef.current = null;
        ocrRequestIdRef.current = null;
        // removeSandboxIframe(); // Decide whether to remove or keep for reuse
      } else {
        console.warn(
          "[useEpcProcessor] Received OCR result for unexpected/mismatched request ID:",
          messageData.requestId,
          "Expected:",
          ocrRequestIdRef.current
        );
      }
    };
    window.addEventListener("message", handleSandboxMessage);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("message", handleSandboxMessage);
      if (iframe) {
        console.log("[useEpcProcessor] Removing sandbox iframe on unmount.");
        iframe.remove();
      }
    };
  }, []);

  // Function to ensure sandbox iframe exists
  const ensureSandboxIframe = (): Promise<HTMLIFrameElement> => {
    return new Promise((resolve, reject) => {
      if (sandboxIframeRef.current && document.body.contains(sandboxIframeRef.current)) {
        console.log("[useEpcProcessor] Reusing existing sandbox iframe.");
        resolve(sandboxIframeRef.current);
        return;
      }
      console.log("[useEpcProcessor] Attempting to create sandbox iframe...");
      const iframe = document.createElement("iframe");
      iframe.src = chrome.runtime.getURL(SANDBOX_HTML_PATH);
      iframe.style.display = "none";

      iframe.onload = () => {
        console.log("[useEpcProcessor] Sandbox iframe ONLOAD event fired.");
        sandboxIframeRef.current = iframe;
        resolve(iframe);
      };

      iframe.onerror = (event) => {
        console.error("[useEpcProcessor] Sandbox iframe ONERROR event fired:", event);
        iframe.remove(); // Clean up failed iframe
        sandboxIframeRef.current = null;
        reject(new Error("Failed to load sandbox iframe."));
      };

      try {
        console.log("[useEpcProcessor] Appending sandbox iframe to body...");
        document.body.appendChild(iframe);
        console.log("[useEpcProcessor] Sandbox iframe appended. Waiting for onload/onerror...");
      } catch (error) {
        console.error("[useEpcProcessor] Error appending sandbox iframe:", error);
        reject(error);
      }
    });
  };

  // Function to remove the iframe
  const removeSandboxIframe = () => {
    if (sandboxIframeRef.current) {
      console.log("[useEpcProcessor] Removing sandbox iframe.");
      sandboxIframeRef.current.remove();
      sandboxIframeRef.current = null;
    }
  };

  useEffect(() => {
    const processUrl = async () => {
      if (!originalImageUrl || !originalImageUrl.startsWith("http")) {
        // Reset to idle/initial state if no valid URL
        setProcessingState({
          ...INITIAL_STATE,
          status: DataStatus.NOT_APPLICABLE,
          displayValue: String(initialValue ?? "N/A"),
          isLoading: false, // Ensure loading is false
        });
        removeSandboxIframe(); // Clean up iframe if URL becomes invalid
        return;
      }

      // Set initial loading state
      setProcessingState({
        ...INITIAL_STATE,
        isLoading: true,
        status: DataStatus.IS_LOADING,
        displayValue: "Checking URL type...",
      });

      // --- Check if URL is PDF ---
      let isPdf = false;
      try {
        // Only need isPdfUrl dynamically now
        const { isPdfUrl } = await import("@/utils/pdfProcessingUtils");
        isPdf = isPdfUrl(originalImageUrl);
      } catch (e) {
        console.error("Failed to dynamically import isPdfUrl:", e);
        if (!isMountedRef.current) return;
        setProcessingState((prev) => ({
          ...prev,
          isLoading: false,
          status: DataStatus.ASK_AGENT,
          error: "Failed to load PDF checker",
          displayValue: "Error initializing",
          epcDataSource: null,
        }));
        return;
      }

      if (isPdf) {
        // --- Handle PDF Processing via Sandbox ---
        setProcessingState((prevState) => ({ ...prevState, displayValue: "Rendering PDF..." }));

        try {
          // 1. Render PDF page locally
          const imageDataUrl = await renderPdfPageToDataUrl(originalImageUrl);
          if (!isMountedRef.current) return;
          if (!imageDataUrl) throw new Error("Failed to render PDF page.");

          // 2. Ensure sandbox exists (now returns a promise)
          setProcessingState((prevState) => ({
            ...prevState,
            displayValue: "Preparing secure processor...",
          }));
          const iframe = await ensureSandboxIframe(); // Await the promise
          if (!isMountedRef.current) return; // Check mount status after async operation

          const requestId = crypto.randomUUID();
          ocrRequestIdRef.current = requestId;

          // 3. Set up promise/callback for the result
          const ocrPromise = new Promise<PerformOcrResponseData>((resolve) => {
            ocrCallbackRef.current = resolve;
          });

          // 4. Send task to sandbox iframe via postMessage WHEN it loads
          setProcessingState((prevState) => ({
            ...prevState,
            displayValue: "Sending page for analysis...",
          }));
          if (iframe.contentWindow) {
            console.log(`[useEpcProcessor] Posting OCR task with ID: ${requestId} to sandbox.`);
            iframe.contentWindow.postMessage(
              {
                action: "PERFORM_OCR",
                requestId: requestId,
                data: { imageDataUrl },
              },
              "*"
            );
          } else {
            throw new Error("Sandbox iframe contentWindow is not accessible.");
          }

          // 5. Wait for the result from the sandbox listener
          const result = await ocrPromise;
          if (!isMountedRef.current) return;

          // ++ Add logging here to see the received result object ++
          console.log("[useEpcProcessor] OCR Promise resolved with result:", result);

          // 6. Process result
          if (result.success && result.text) {
            setProcessingState((prevState) => ({
              ...prevState,
              status: DataStatus.IS_LOADING, // Still loading while extracting
              displayValue: "Extracting data...", // Update display value
            }));

            // --- Pass result.text to your extraction logic ---
            const extractedData = extractDataFromText(result.text);
            // --- (End extraction logic) ---

            // Determine final status based on extraction
            const finalStatus = extractedData ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT;
            const finalDisplayValue = extractedData
              ? "EPC Data Extracted" // Or format extractedData if needed
              : "Could not find EPC data in document.";
            const finalError = extractedData ? null : "Could not find EPC data in the document.";

            setProcessingState((prevState) => ({
              ...prevState,
              status: finalStatus,
              displayValue: finalDisplayValue,
              epcDataSource: { type: "pdf", data: extractedData }, // Store extracted data
              error: finalError,
              isLoading: false, // Done loading
            }));
          } else {
            // If success is false, or text is missing, use the error from the sandbox
            const errorMessage = result.error || "OCR failed in sandbox without specific error.";
            console.error("[useEpcProcessor] OCR failed in sandbox:", errorMessage);
            const errorToLog = new Error(`Sandbox OCR Error: ${errorMessage}`);
            logErrorToSentry(errorToLog, "error"); // Log error to Sentry
            throw errorToLog; // Throw the specific error
          }
        } catch (error) {
          if (!isMountedRef.current) return; // Check mount status again after async op
          console.error("[useEpcProcessor] Error during PDF processing pipeline:", error);
          const displayError =
            error instanceof Error ? error.message : "An unknown error occurred during processing.";
          // Log the caught error to Sentry
          logErrorToSentry(error instanceof Error ? error : new Error(displayError), "error");
          setProcessingState((prevState) => ({
            ...prevState,
            status: DataStatus.ASK_AGENT, // Fallback status on error
            displayValue: `Error: ${displayError}`,
            isLoading: false,
            error: displayError,
            epcDataSource: null,
          }));
        }
      } else {
        // --- Handle Image Processing ---
        setProcessingState((prevState) => ({
          ...prevState,
          displayValue: "Fetching image...",
          epcDataSource: null, // Clear any previous source
        }));

        console.log(`[useEpcProcessor] Requesting fetch for image: ${originalImageUrl}`);
        removeSandboxIframe(); // Clean up iframe if not needed
        chrome.runtime.sendMessage(
          { action: ActionEvents.FETCH_IMAGE_FOR_CANVAS, url: originalImageUrl },
          (response) => {
            if (!isMountedRef.current) return;

            if (response?.success && response.dataUrl) {
              const fetchedDataUrl = response.dataUrl;
              setProcessingState((prevState) => ({
                ...prevState,
                displayValue: "Analysing image...",
                // Don't set epcDataSource yet, wait for processing result
              }));

              processEpcImageDataUrl(fetchedDataUrl, debugCanvasRef?.current)
                .then((result) => {
                  if (!isMountedRef.current) return;

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
                    isLoading: false,
                    error: result.error || (hasBands ? null : "Could not determine bands"),
                    epcDataSource: { type: "image", url: fetchedDataUrl, result: result }, // Set unified source
                  });
                })
                .catch((error) => {
                  console.error(`[useEpcProcessor] Canvas processing failed:`, error);
                  if (!isMountedRef.current) return;
                  const errorMsg =
                    error instanceof Error ? error.message : "Canvas processing failed.";
                  // Even on canvas error, we have the image URL
                  setProcessingState({
                    status: DataStatus.ASK_AGENT,
                    displayValue: `Error: ${errorMsg}`,
                    isLoading: false,
                    error: errorMsg,
                    // Set source with URL but indicate error in result
                    epcDataSource: {
                      type: "image",
                      url: fetchedDataUrl,
                      result: { error: errorMsg },
                    },
                  });
                });
            } else {
              const errorMsg = response?.error || "Failed to fetch image data.";
              console.error(`[useEpcProcessor] Background fetch failed:`, errorMsg);
              if (isMountedRef.current) {
                setProcessingState({
                  status: DataStatus.ASK_AGENT,
                  displayValue: `Error: ${errorMsg}`,
                  isLoading: false,
                  error: errorMsg,
                  epcDataSource: null,
                });
              }
            }
          }
        );
      }
    };

    processUrl();
  }, [originalImageUrl, initialValue, debugCanvasRef]);

  // Combine loading state into the main status for simplicity if needed by consumer
  const finalStatus = processingState.isLoading ? DataStatus.IS_LOADING : processingState.status;

  return {
    ...processingState,
    status: finalStatus,
  };
};
