import { ActionEvents } from "@/constants/actionEvents";
import { processEpcImageDataUrl } from "@/sidepanel/propertychecklist/epcImageUtils";
import { ConfidenceLevels, DataStatus, EpcData, EpcDataSourceType } from "@/types/property";
import {
  extractAddressAndPdfDataFromText,
  renderPdfPageToDataUrl,
} from "@/utils/pdfProcessingUtils";
import { logErrorToSentry } from "@/utils/sentry";

// --- Constants ---
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
const SANDBOX_HTML_PATH = "sandbox.html";

// --- Types ---
export interface EpcProcessorResult extends EpcData {
  isLoading: boolean;
  status: DataStatus;
}

// Initial state structure
export const INITIAL_EPC_RESULT_STATE: EpcProcessorResult = {
  url: null,
  displayUrl: null,
  automatedProcessingResult: null,
  value: null,
  confidence: ConfidenceLevels.NONE,
  source: EpcDataSourceType.NONE,
  error: null,
  isLoading: false, // Typically true when useQuery calls queryFn
  status: DataStatus.NOT_APPLICABLE,
};

// Structure for OCR result from sandbox
interface PerformOcrResponseData {
  success: boolean;
  text?: string;
  error?: string;
}

// --- Sandbox Management (Module Scope) ---
// Keep track of the iframe promise to avoid creating multiple instances
let sandboxIframePromise: Promise<HTMLIFrameElement> | null = null;
let ocrCallback: ((result: PerformOcrResponseData) => void) | null = null;
let currentOcrRequestId: string | null = null;

// Listener for messages FROM sandbox (defined once)
const handleSandboxMessage = (message: MessageEvent) => {
  interface SandboxResultMessage {
    source: "sandbox";
    action: "OCR_RESULT";
    requestId?: string;
    data: PerformOcrResponseData;
  }
  const messageData = message.data as SandboxResultMessage;

  if (!messageData || messageData.source !== "sandbox" || messageData.action !== "OCR_RESULT") {
    return;
  }
  console.log("[epcProcessing] Received OCR_RESULT from sandbox:", messageData);

  if (currentOcrRequestId && messageData.requestId === currentOcrRequestId) {
    if (ocrCallback) {
      ocrCallback(messageData.data); // Resolve the promise
    }
    // Clear pending request
    ocrCallback = null;
    currentOcrRequestId = null;
    // Consider removing iframe if not needed anymore, or keep for reuse
    // removeSandboxIframe();
  } else {
    console.warn(
      "[epcProcessing] Received OCR result for unexpected/mismatched request ID:",
      messageData.requestId,
      "Expected:",
      currentOcrRequestId
    );
  }
};

// Ensure the listener is added only once
if (typeof window !== "undefined") {
  window.removeEventListener("message", handleSandboxMessage); // Remove previous if exists (e.g., HMR)
  window.addEventListener("message", handleSandboxMessage);
}

// Function to ensure sandbox iframe exists (returns a promise)
const ensureSandboxIframe = (): Promise<HTMLIFrameElement> => {
  if (sandboxIframePromise) {
    // If a promise already exists, check if the iframe is still valid
    return sandboxIframePromise
      .then((iframe) => {
        if (document.body.contains(iframe)) {
          console.log("[epcProcessing] Reusing existing sandbox iframe.");
          return iframe;
        } else {
          console.log("[epcProcessing] Old iframe removed from DOM, creating new one.");
          sandboxIframePromise = null; // Clear promise
          return createSandboxIframe(); // Create a new one
        }
      })
      .catch((error) => {
        console.error("[epcProcessing] Error reusing/checking iframe, creating new one.", error);
        sandboxIframePromise = null; // Clear promise on error
        return createSandboxIframe(); // Create a new one
      });
  }
  // If no promise exists, create one
  sandboxIframePromise = createSandboxIframe();
  return sandboxIframePromise;
};

// Creates the iframe and returns a promise that resolves on load or rejects on error
const createSandboxIframe = (): Promise<HTMLIFrameElement> => {
  console.log("[epcProcessing] Attempting to create sandbox iframe...");
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL(SANDBOX_HTML_PATH);
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true"); // Accessibility

    iframe.onload = () => {
      console.log("[epcProcessing] Sandbox iframe ONLOAD event fired.");
      // Optional: Add cleanup listener if iframe gets removed unexpectedly
      // We might rely on ensureSandboxIframe check instead
      resolve(iframe);
    };

    iframe.onerror = (event) => {
      console.error("[epcProcessing] Sandbox iframe ONERROR event fired:", event);
      iframe.remove(); // Clean up failed iframe
      sandboxIframePromise = null; // Clear the promise so next call tries again
      reject(new Error("Failed to load sandbox iframe."));
    };

    try {
      console.log("[epcProcessing] Appending sandbox iframe to body...");
      document.body.appendChild(iframe);
      console.log("[epcProcessing] Sandbox iframe appended. Waiting for onload/onerror...");
    } catch (error) {
      console.error("[epcProcessing] Error appending sandbox iframe:", error);
      reject(error);
    }
  });
};

// Function to remove the iframe if needed (e.g., for cleanup)
// Note: Decide carefully when to call this. Keeping it might be more efficient.
export const removeSandboxIframe = () => {
  if (sandboxIframePromise) {
    sandboxIframePromise
      .then((iframe) => {
        if (iframe && document.body.contains(iframe)) {
          console.log("[epcProcessing] Removing sandbox iframe.");
          iframe.remove();
        }
      })
      .catch((err) => {
        console.error("[epcProcessing] Error removing sandbox iframe:", err);
      });
    sandboxIframePromise = null; // Clear the promise
  }
};

// --- OCR Task ---
const performOcrInSandbox = async (imageDataUrl: string): Promise<PerformOcrResponseData> => {
  const iframe = await ensureSandboxIframe(); // Get or create the iframe

  console.log("[epcProcessing] iframe object after ensure:", iframe);
  console.log("[epcProcessing] iframe.contentWindow after ensure:", iframe.contentWindow);

  // Setup the promise and callback reference *before* posting the message
  const requestId = crypto.randomUUID();
  currentOcrRequestId = requestId;
  const ocrPromise = new Promise<PerformOcrResponseData>((resolve) => {
    ocrCallback = resolve; // Assign the resolve function to the module-scope callback
  });

  if (iframe.contentWindow) {
    console.log(`[epcProcessing] Posting OCR task with ID: ${requestId} to sandbox.`);
    iframe.contentWindow.postMessage(
      { action: "PERFORM_OCR", requestId, data: { imageDataUrl } },
      "*"
    );
  } else {
    console.error("[epcProcessing] Error: iframe.contentWindow was null or inaccessible.");
    currentOcrRequestId = null; // Clean up request ID
    ocrCallback = null; // Clean up callback
    throw new Error("Sandbox iframe contentWindow is not accessible.");
  }

  // Await the promise which will be resolved by handleSandboxMessage
  const result = await ocrPromise;
  return result;
};

// --- Processing Functions ---

/**
 * Processes a PDF URL to extract EPC data using OCR in a sandbox.
 * @param processingUrl URL of the PDF file.
 * @returns EpcProcessorResult object.
 */
const processPdfUrl = async (processingUrl: string): Promise<EpcProcessorResult> => {
  try {
    const imageDataUrl = await renderPdfPageToDataUrl(processingUrl);
    if (!imageDataUrl) {
      throw new Error("Failed to render PDF page to data URL.");
    }

    const result = await performOcrInSandbox(imageDataUrl);

    if (result.success && result.text) {
      const extractedData = extractAddressAndPdfDataFromText(result.text);
      const extractedEpcValue = extractedData?.currentEpcRating ?? null;

      return {
        ...INITIAL_EPC_RESULT_STATE, // Start fresh
        url: processingUrl,
        isLoading: false,
        status: extractedEpcValue ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT,
        automatedProcessingResult: extractedData,
        value: extractedEpcValue,
        confidence: extractedEpcValue ? ConfidenceLevels.HIGH : ConfidenceLevels.NONE,
        source: extractedEpcValue ? EpcDataSourceType.PDF : EpcDataSourceType.NONE, // Source is PDF if value found
        error: extractedEpcValue ? null : "Could not extract EPC data from PDF.",
      };
    } else {
      const errorMsg = result.error || "OCR failed in sandbox.";
      throw new Error(errorMsg);
    }
  } catch (error) {
    const displayError = error instanceof Error ? error.message : "PDF processing failed.";
    logErrorToSentry(error instanceof Error ? error : new Error(displayError), "error");
    return {
      ...INITIAL_EPC_RESULT_STATE, // Start fresh
      url: processingUrl,
      isLoading: false,
      status: DataStatus.ASK_AGENT,
      error: displayError,
      confidence: ConfidenceLevels.NONE,
      source: EpcDataSourceType.NONE, // No source determined on error
    };
  }
};

/**
 * Processes an image URL to extract EPC data using background script and image utils.
 * @param processingUrl URL of the image file.
 * @param debugCanvas Optional canvas ref for debugging.
 * @returns EpcProcessorResult object.
 */
const processImageUrl = async (
  processingUrl: string,
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>
): Promise<EpcProcessorResult> => {
  removeSandboxIframe(); // No sandbox needed for image processing
  console.log(`[epcProcessing] Requesting fetch for image: ${processingUrl}`);

  try {
    // Fetch image as data URL via background script
    const response = await new Promise<{
      success: boolean;
      dataUrl?: string;
      error?: string;
    }>((resolve) => {
      chrome.runtime.sendMessage(
        { action: ActionEvents.FETCH_IMAGE_FOR_CANVAS, url: processingUrl },
        (res) => resolve(res || { success: false, error: "No response from background script" })
      );
    });

    if (response.success && response.dataUrl) {
      const fetchedDataUrl = response.dataUrl;
      // Process the data URL for EPC bands
      const result = await processEpcImageDataUrl(fetchedDataUrl, debugCanvasRef?.current);

      const extractedEpcValue = result.currentBand?.letter ?? null;
      const hasPotentialBand = !!result.potentialBand?.letter;
      const hasBands = !!extractedEpcValue || hasPotentialBand;

      return {
        ...INITIAL_EPC_RESULT_STATE, // Start fresh
        url: processingUrl, // Keep original URL
        displayUrl: fetchedDataUrl, // Store data URI for display
        isLoading: false,
        status: result.error
          ? DataStatus.ASK_AGENT
          : hasBands
            ? DataStatus.FOUND_POSITIVE
            : DataStatus.ASK_AGENT,
        automatedProcessingResult: result,
        value: extractedEpcValue,
        confidence: result.error
          ? ConfidenceLevels.NONE
          : extractedEpcValue
            ? ConfidenceLevels.MEDIUM
            : ConfidenceLevels.NONE,
        source: result.error
          ? EpcDataSourceType.NONE
          : extractedEpcValue
            ? EpcDataSourceType.IMAGE
            : EpcDataSourceType.NONE,
        error: result.error || (hasBands ? null : "Could not determine bands from image."),
      };
    } else {
      throw new Error(response.error || "Failed to fetch image data from background.");
    }
  } catch (error) {
    const displayError = error instanceof Error ? error.message : "Image processing failed.";
    logErrorToSentry(error instanceof Error ? error : new Error(displayError), "error");
    return {
      ...INITIAL_EPC_RESULT_STATE, // Start fresh
      url: processingUrl,
      isLoading: false,
      status: DataStatus.ASK_AGENT,
      error: displayError,
      confidence: ConfidenceLevels.NONE,
      source: EpcDataSourceType.NONE,
      displayUrl: null, // Clear displayUrl on error
    };
  }
};

// --- Main Exported Function (for useQuery's queryFn) ---

/**
 * Processes an EPC URL (PDF or Image) to extract relevant data.
 * This function is intended to be used as the queryFn for TanStack Query.
 * @param processingUrl The URL to process.
 * @param debugCanvasRef Optional ref for debugging image processing.
 * @returns A promise resolving to EpcProcessorResult.
 */
export const processEpcData = async (
  processingUrl: string,
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>
): Promise<EpcProcessorResult> => {
  console.log(`[epcProcessing] Starting processing for URL: ${processingUrl}`);

  const isPdf = processingUrl.toLowerCase().endsWith(".pdf");
  const isImage = IMAGE_EXTENSIONS.some((ext) => processingUrl.toLowerCase().endsWith(ext));

  if (isPdf) {
    return await processPdfUrl(processingUrl);
  } else if (isImage) {
    return await processImageUrl(processingUrl, debugCanvasRef);
  } else {
    // Handle case where URL is neither PDF nor known Image extension
    console.warn(`[epcProcessing] URL is not a PDF or known image type: ${processingUrl}`);
    return {
      ...INITIAL_EPC_RESULT_STATE, // Start fresh
      url: processingUrl,
      isLoading: false,
      status: DataStatus.ASK_AGENT,
      error: "Unsupported URL type for EPC processing.",
      confidence: ConfidenceLevels.NONE,
      source: EpcDataSourceType.NONE,
      displayUrl: null,
    };
  }
};
