import { ActionEvents } from "@/constants/actionEvents";
import { processEpcImageDataUrl } from "@/sidepanel/propertychecklist/epcImageUtils";
import { DataStatus, EpcConfidenceLevels, EpcData, EpcDataSourceType } from "@/types/property";
import {
  extractAddressAndPdfDataFromText,
  renderPdfPageToDataUrl,
} from "@/utils/pdfProcessingUtils";
import { logErrorToSentry } from "@/utils/sentry";
import { useEffect, useRef, useState } from "react";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export interface EpcProcessorResult extends EpcData {
  isLoading: boolean;
  status: DataStatus;
}

const INITIAL_EPC_RESULT_STATE: EpcProcessorResult = {
  url: null,
  displayUrl: null,
  scores: null,
  value: null,
  confidence: EpcConfidenceLevels.NONE,
  source: EpcDataSourceType.NONE,
  error: null,
  isLoading: false,
  status: DataStatus.NOT_APPLICABLE,
};

// Constant for sandbox path
const SANDBOX_HTML_PATH = "sandbox.html";

// Need to re-define this or import if moved to a shared types file
interface PerformOcrResponseData {
  success: boolean;
  text?: string;
  error?: string;
}

export const useEpcProcessor = (
  initialEpcData: EpcData | null | undefined,
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>
): EpcProcessorResult => {
  const [epcResultState, setEpcResultState] = useState<EpcProcessorResult>(() => {
    // Initialize state including displayUrl
    if (initialEpcData) {
      return {
        ...INITIAL_EPC_RESULT_STATE,
        ...initialEpcData, // Spread initial data (includes url, value, confidence, source)
        displayUrl: initialEpcData.displayUrl ?? null, // Initialize if present
        status: initialEpcData.value ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT,
      };
    } else {
      return INITIAL_EPC_RESULT_STATE;
    }
  });

  const isMountedRef = useRef(true);
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
    const processEpc = async () => {
      console.log(
        "[useEpcProcessor] useEffect triggered. initialEpcData:",
        JSON.stringify(initialEpcData)
      );

      const processingUrl = initialEpcData?.url;

      if (!processingUrl) {
        console.log("[useEpcProcessor] URL is null/undefined, waiting for update...");
        return;
      }

      setEpcResultState((prev) => ({
        ...prev,
        isLoading: true,
        status: DataStatus.IS_LOADING,
        error: null,
      }));

      // --- Check if URL is PDF or Image ---
      const isPdf = processingUrl.toLowerCase().endsWith(".pdf");
      const isImage = IMAGE_EXTENSIONS.some((ext) => processingUrl.toLowerCase().endsWith(ext));

      // --- PDF Processing ---
      if (isPdf) {
        try {
          const imageDataUrl = await renderPdfPageToDataUrl(processingUrl);
          if (!isMountedRef.current || !imageDataUrl) {
            throw new Error(imageDataUrl ? "Component unmounted" : "Failed to render PDF page.");
          }

          setEpcResultState((prev) => ({ ...prev, status: DataStatus.IS_LOADING, error: null }));
          const iframe = await ensureSandboxIframe();
          if (!isMountedRef.current) return;

          console.log("[useEpcProcessor] iframe object after ensure:", iframe);
          console.log("[useEpcProcessor] iframe.contentWindow after ensure:", iframe.contentWindow);

          const requestId = crypto.randomUUID();
          ocrRequestIdRef.current = requestId;
          const ocrPromise = new Promise<PerformOcrResponseData>((resolve) => {
            ocrCallbackRef.current = resolve;
          });

          console.log("[useEpcProcessor] Reached point before checking iframe.contentWindow");

          if (iframe.contentWindow) {
            console.log(`[useEpcProcessor] Posting OCR task with ID: ${requestId} to sandbox.`);
            iframe.contentWindow.postMessage(
              { action: "PERFORM_OCR", requestId, data: { imageDataUrl } },
              "*"
            );
          } else {
            console.error(
              "[useEpcProcessor] Error: iframe.contentWindow was null or inaccessible."
            );
            throw new Error("Sandbox iframe contentWindow is not accessible.");
          }

          const result = await ocrPromise;
          if (!isMountedRef.current) return;

          if (result.success && result.text) {
            const extractedData = extractAddressAndPdfDataFromText(result.text);
            const extractedEpcValue = extractedData?.currentEpcRating ?? null;

            setEpcResultState((prev) => ({
              ...prev,
              url: processingUrl,
              isLoading: false,
              status: extractedEpcValue ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT,
              scores: extractedData,
              value: extractedEpcValue,
              confidence: extractedEpcValue ? EpcConfidenceLevels.HIGH : EpcConfidenceLevels.NONE,
              source: extractedEpcValue ? EpcDataSourceType.PDF : prev.source,
              error: extractedEpcValue ? null : "Could not extract EPC data from PDF.",
            }));
          } else {
            const errorMsg = result.error || "OCR failed in sandbox.";
            throw new Error(errorMsg);
          }
        } catch (error) {
          if (!isMountedRef.current) return;
          const displayError = error instanceof Error ? error.message : "PDF processing failed.";
          logErrorToSentry(error instanceof Error ? error : new Error(displayError), "error");
          setEpcResultState((prev) => ({
            ...prev,
            isLoading: false,
            status: DataStatus.ASK_AGENT,
            error: displayError,
            confidence: EpcConfidenceLevels.NONE,
          }));
        }
        // --- Image Processing ---
      } else if (isImage) {
        removeSandboxIframe();
        console.log(`[useEpcProcessor] Requesting fetch for image: ${processingUrl}`);

        try {
          // Send message to background to fetch image as data URL
          const response = await new Promise<{
            success: boolean;
            dataUrl?: string;
            error?: string;
          }>((resolve) => {
            chrome.runtime.sendMessage(
              { action: ActionEvents.FETCH_IMAGE_FOR_CANVAS, url: processingUrl },
              (res) =>
                resolve(res || { success: false, error: "No response from background script" })
            );
          });

          if (!isMountedRef.current) return;

          if (response.success && response.dataUrl) {
            const fetchedDataUrl = response.dataUrl;
            // Now process the data URL for EPC bands
            const result = await processEpcImageDataUrl(fetchedDataUrl, debugCanvasRef?.current);
            if (!isMountedRef.current) return;

            const extractedEpcValue = result.currentBand?.letter ?? null;
            const hasPotentialBand = !!result.potentialBand?.letter;
            const hasBands = !!extractedEpcValue || hasPotentialBand;

            // Update state with results AND the fetched data URL for display
            setEpcResultState((prev) => {
              const newState = {
                ...prev,
                url: processingUrl, // Keep original URL
                displayUrl: fetchedDataUrl, // Store data URI for display
                isLoading: false,
                status: result.error
                  ? DataStatus.ASK_AGENT
                  : hasBands
                    ? DataStatus.FOUND_POSITIVE
                    : DataStatus.ASK_AGENT,
                scores: result,
                value: extractedEpcValue,
                confidence: result.error
                  ? EpcConfidenceLevels.NONE
                  : extractedEpcValue
                    ? EpcConfidenceLevels.MEDIUM
                    : EpcConfidenceLevels.NONE,
                source: result.error
                  ? prev.source
                  : extractedEpcValue
                    ? EpcDataSourceType.IMAGE
                    : prev.source,
                error: result.error || (hasBands ? null : "Could not determine bands from image."),
              };
              return newState;
            });
          } else {
            // Handle background fetch failure
            throw new Error(response.error || "Failed to fetch image data from background.");
          }
        } catch (error) {
          // ... (handle image processing error - set status, error, isLoading false) ...
          if (!isMountedRef.current) return;
          const displayError = error instanceof Error ? error.message : "Image processing failed.";
          logErrorToSentry(error instanceof Error ? error : new Error(displayError), "error");
          setEpcResultState((prev) => ({
            ...prev,
            isLoading: false,
            status: DataStatus.ASK_AGENT,
            error: displayError,
            confidence: EpcConfidenceLevels.NONE,
            source: prev.source, // Keep previous source on error
            displayUrl: null, // Clear displayUrl on error
          }));
        }
      } else {
        // Handle case where URL is neither PDF nor known Image extension
        console.warn(`[useEpcProcessor] URL is not a PDF or known image type: ${processingUrl}`);
        setEpcResultState((prev) => ({
          ...prev,
          isLoading: false,
          status: DataStatus.ASK_AGENT,
          error: "Unsupported URL type for EPC processing.",
          confidence: EpcConfidenceLevels.NONE,
          source: prev.source,
          displayUrl: null,
        }));
      }
    };

    processEpc();
    // Ensure displayUrl is part of dependencies if its update should trigger re-renders reliant on it directly
    // However, url, confidence, value, source are the primary triggers for processing logic
  }, [
    initialEpcData?.url,
    initialEpcData?.confidence,
    initialEpcData?.value,
    initialEpcData?.source,
    debugCanvasRef,
  ]);

  // No need for finalStatus calculation, it's part of the state

  return epcResultState; // Return the unified state object
};
