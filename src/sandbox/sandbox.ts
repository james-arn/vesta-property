// This is used when the epc link is a pdf  - we process PDFs to get the address and EPC data using sandbox for performance reasons to keep it off the main thread.
import Tesseract from "tesseract.js";

console.log("[sandbox.ts] Sandbox page loaded.");

// --- Tesseract Configuration ---
const TESSERACT_CONFIG = {
  workerPath: "../worker.min.js", // Relative path from sandbox.js to dist root
  corePath: "../tesseract-core/", // Relative path from sandbox.js to tesseract-core dir
  // langPath: '../lang-data/', // Relative path if language data is added later
  logger: (m: Tesseract.LoggerMessage) =>
    console.log("[Sandbox Tesseract]", m.status, m.progress ? m.progress * 100 + "%" : ""),
};

// Function to perform OCR within the sandbox
async function performOcr(
  imageDataUrl: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  let worker: Tesseract.Worker | null = null;
  console.log("[sandbox.ts] Starting OCR...");
  try {
    worker = await Tesseract.createWorker(
      "eng",
      1,
      TESSERACT_CONFIG as Partial<Tesseract.WorkerOptions>
    );
    const {
      data: { text },
    } = await worker.recognize(imageDataUrl);
    console.log("[sandbox.ts] OCR successful.");
    return { success: true, text };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Tesseract OCR failed in sandbox.";
    console.error("[sandbox.ts] OCR Error:", errorMsg, error);
    return { success: false, error: errorMsg };
  } finally {
    await worker?.terminate();
    console.log("[sandbox.ts] Tesseract worker terminated.");
  }
}

// Define the expected structure for the result object more explicitly
interface OcrResult {
  success: boolean;
  text?: string;
  error?: string;
}

// Listen for messages FROM the Side Panel via postMessage
window.addEventListener("message", async (event) => {
  // Basic security check: Ensure the message comes from the extension itself
  if (
    event.source !== window.parent ||
    !event.origin.startsWith(window.location.origin.split("//")[0])
  ) {
    // In MV3 sandboxes, event.origin might be null or opaque. Check source is safer.
    if (event.source !== window.parent) {
      console.warn("[sandbox.ts] Ignored message from unexpected source:", event.source);
      return;
    }
    console.log("[sandbox.ts] Received message with potentially opaque origin:", event.origin);
  }

  const request = event.data;
  console.log("[sandbox.ts] Received postMessage:", request);

  // Check if it's the OCR request
  if (request.action === "PERFORM_OCR" && request.data?.imageDataUrl && request.requestId) {
    console.log(`[sandbox.ts] Handling PERFORM_OCR request ID: ${request.requestId}`);
    // Use the explicit interface for the result type
    const result: OcrResult = await performOcr(request.data.imageDataUrl);

    // Logging the result object after receiving it from performOcr
    console.log(`[sandbox.ts] OCR processing complete. Result object:`, result);

    // Send result back TO THE SIDE PANEL via postMessage
    // Log the full result object for debugging (Can be removed later)
    console.log(`[sandbox.ts] Preparing to send result for ID ${request.requestId}:`, result);
    // Concise log (Can be removed later)
    console.log(
      `[sandbox.ts] Concise log: Sending result back for ID: ${request.requestId}`,
      result.success
        ? { success: true, text: result.text?.substring(0, 50) + "..." }
        : { success: false, error: result.error }
    );
    window.parent.postMessage(
      {
        source: "sandbox",
        action: "OCR_RESULT",
        requestId: request.requestId, // Pass back original ID
        data: result,
      },
      "*"
    );
  }
});
