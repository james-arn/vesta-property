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

  // Added more verbose logging here
  console.log("[epcProcessing] handleSandboxMessage: Received message event. Data:", messageData);

  if (
    !messageData ||
    typeof messageData !== "object" ||
    messageData.source !== "sandbox" ||
    messageData.action !== "OCR_RESULT"
  ) {
    console.log(
      "[epcProcessing] handleSandboxMessage: Message ignored (not a valid OCR_RESULT from sandbox).",
      "Expected source 'sandbox', got:",
      messageData?.source,
      "Expected action 'OCR_RESULT', got:",
      messageData?.action
    );
    return;
  }
  console.log(
    "[epcProcessing] handleSandboxMessage: Valid OCR_RESULT received from sandbox. Request ID:",
    messageData.requestId,
    "Expected ID:",
    currentOcrRequestId
  );

  if (currentOcrRequestId && messageData.requestId === currentOcrRequestId) {
    if (ocrCallback) {
      console.log(
        "[epcProcessing] handleSandboxMessage: Invoking ocrCallback for request ID:",
        currentOcrRequestId
      );
      ocrCallback(messageData.data); // Resolve the promise
    } else {
      console.warn(
        "[epcProcessing] handleSandboxMessage: ocrCallback is null for request ID:",
        currentOcrRequestId
      );
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
  console.log("[epcProcessing] createSandboxIframe: Attempting to create sandbox iframe...");
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    try {
      iframe.src = chrome.runtime.getURL(SANDBOX_HTML_PATH);
      console.log("[epcProcessing] createSandboxIframe: Set iframe.src to:", iframe.src);
    } catch (e) {
      console.error(
        "[epcProcessing] createSandboxIframe: ERROR calling chrome.runtime.getURL with path:",
        SANDBOX_HTML_PATH,
        e
      );
      reject(
        new Error(
          `Failed to get URL for sandbox.html: ${e instanceof Error ? e.message : String(e)}`
        )
      );
      return;
    }
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true"); // Accessibility

    iframe.onload = () => {
      console.log(
        "[epcProcessing] createSandboxIframe: Sandbox iframe ONLOAD event fired. src:",
        iframe.src
      );
      // Optional: Add cleanup listener if iframe gets removed unexpectedly
      // We might rely on ensureSandboxIframe check instead
      resolve(iframe);
    };

    iframe.onerror = (event) => {
      console.error(
        "[epcProcessing] createSandboxIframe: Sandbox iframe ONERROR event fired. src:",
        iframe.src,
        "Error event:",
        event
      );
      iframe.remove(); // Clean up failed iframe
      sandboxIframePromise = null; // Clear the promise so next call tries again
      reject(
        new Error(
          "Failed to load sandbox iframe. Check manifest.json web_accessible_resources and sandbox path."
        )
      );
    };

    try {
      console.log("[epcProcessing] Appending sandbox iframe to document.body...");
      document.body.appendChild(iframe);
      console.log("[epcProcessing] Sandbox iframe appended. Waiting for onload/onerror...");
    } catch (error) {
      console.error("[epcProcessing] Error appending sandbox iframe to document.body:", error);
      sandboxIframePromise = null; // Clear promise here too, as iframe instance is lost
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
  console.log("[epcProcessing] performOcrInSandbox: Ensuring sandbox iframe...");
  const iframe = await ensureSandboxIframe(); // Get or create the iframe

  console.log(
    "[epcProcessing] performOcrInSandbox: iframe object after ensure:",
    iframe ? iframe.src : "null iframe"
  );
  console.log(
    "[epcProcessing] performOcrInSandbox: iframe.contentWindow after ensure:",
    iframe ? (iframe.contentWindow ? "exists" : "null") : "N/A"
  );

  // Setup the promise and callback reference *before* posting the message
  const requestId = crypto.randomUUID();
  currentOcrRequestId = requestId;
  console.log(
    "[epcProcessing] performOcrInSandbox: Generated new OCR request ID:",
    currentOcrRequestId
  );

  const ocrPromise = new Promise<PerformOcrResponseData>((resolve, reject) => {
    ocrCallback = (result) => {
      // Wrapped to log
      console.log(
        "[epcProcessing] performOcrInSandbox: ocrCallback invoked with result for request ID:",
        currentOcrRequestId,
        result
      );
      resolve(result);
    };
    // Basic timeout for the callback, in case sandbox never responds
    setTimeout(() => {
      if (currentOcrRequestId === requestId) {
        // Only reject if this request is still the active one
        console.error(
          `[epcProcessing] performOcrInSandbox: Timeout waiting for OCR result for request ID: ${requestId}. Sandbox might have crashed or failed to post back.`
        );
        ocrCallback = null; // Clear callback
        currentOcrRequestId = null; // Clear current request ID
        reject(
          new Error(`Timeout waiting for OCR result from sandbox for request ID: ${requestId}.`)
        );
      }
    }, 30000); // 30-second timeout for OCR response from sandbox
  });

  if (iframe && iframe.contentWindow) {
    const messagePayload = { action: "PERFORM_OCR", requestId, data: { imageDataUrl } };
    console.log(
      `[epcProcessing] performOcrInSandbox: Posting OCR task to sandbox. Request ID: ${requestId}, TargetOrigin: '*', Payload:`,
      messagePayload
    );
    iframe.contentWindow.postMessage(messagePayload, "*");
  } else {
    console.error(
      "[epcProcessing] performOcrInSandbox: Error: iframe.contentWindow was null or inaccessible. Cannot post message. iframe src:",
      iframe ? iframe.src : "iframe object is null"
    );
    // Clean up
    currentOcrRequestId = null;
    ocrCallback = null;
    // Reject the promise directly if we can't post the message
    return Promise.reject(
      new Error("Sandbox iframe contentWindow is not accessible. Cannot post message.")
    );
  }

  // Await the promise which will be resolved by handleSandboxMessage
  console.log(
    "[epcProcessing] performOcrInSandbox: Awaiting ocrPromise for request ID:",
    currentOcrRequestId
  );
  try {
    const result = await ocrPromise;
    console.log(
      "[epcProcessing] performOcrInSandbox: ocrPromise resolved for request ID:",
      currentOcrRequestId,
      "Result:",
      result
    );
    return result;
  } catch (error) {
    console.error(
      "[epcProcessing] performOcrInSandbox: ocrPromise rejected for request ID:",
      currentOcrRequestId,
      "Error:",
      error
    );
    // Ensure cleanup if promise was rejected by timeout or other means
    if (currentOcrRequestId === requestId) {
      // Check if it's still the same request
      ocrCallback = null;
      currentOcrRequestId = null;
    }
    throw error; // Re-throw the error to be caught by processPdfUrl
  }
};

// --- Processing Functions ---

/**
 * Processes a PDF URL to extract EPC data using OCR in a sandbox.
 * @param processingUrl URL of the PDF file.
 * @returns EpcProcessorResult object.
 */
export const processPdfUrl = async (
  processingUrl: string,
  domPostcode?: string | null,
  domDisplayAddress?: string | null
): Promise<EpcProcessorResult> => {
  try {
    const imageDataUrl = await renderPdfPageToDataUrl(processingUrl);
    if (!imageDataUrl) {
      throw new Error("Failed to render PDF page to data URL.");
    }

    const result = await performOcrInSandbox(imageDataUrl);

    if (result.success && result.text) {
      console.log("[epcProcessing] Raw OCR Text from Sandbox:", JSON.stringify(result.text));
      const extractedData = extractAddressAndPdfDataFromText(
        result.text,
        domPostcode,
        domDisplayAddress
      );
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
    // For processEpcData, we don't have immediate access to DOM address hints here.
    // This part of the refactor might require a slightly deeper change if processEpcData
    // is called from a context where hints *could* be available but aren't passed.
    // For now, PDF calls originating from background.ts via contentScript will have hints.
    // Calls directly to processEpcData (e.g. from UI if any) won't pass them yet.
    return await processPdfUrl(processingUrl); // Calls processPdfUrl without hints by default
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
