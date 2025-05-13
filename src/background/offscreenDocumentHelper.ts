import { logErrorToSentry } from "../utils/sentry"; // Adjust path as needed

const OFFSCREEN_DOCUMENT_CREATE_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Checks if an offscreen document with the specified path is currently open.
 * @param path The path to the offscreen document's HTML file.
 * @returns Promise<boolean> True if the document exists, false otherwise.
 */
async function hasOffscreenDocument(path: string): Promise<boolean> {
  // Check if chrome.runtime.getContexts is available (it should be in MV3 SW)
  if (!chrome.runtime.getContexts) {
    console.warn(
      "[offscreenDocumentHelper] chrome.runtime.getContexts API not available. Cannot reliably check for offscreen document."
    );
    // Fallback: if the API isn't there, we can't check, so assume it doesn't exist
    // to allow creation attempt. This scenario should be rare in a proper MV3 SW environment.
    return false;
  }
  try {
    const offscreenUrl = chrome.runtime.getURL(path);
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [offscreenUrl],
    });
    return contexts && contexts.length > 0;
  } catch (error) {
    console.error(
      `[offscreenDocumentHelper] Error checking for offscreen document (getContexts) for path ${path}: ${error instanceof Error ? error.message : String(error)}. Assuming no document exists.`
    );
    // If there's an error during the check, assume it doesn't exist to be safe
    // and allow an attempt to create it.
    return false;
  }
}

/**
 * Creates an offscreen document if one doesn't already exist for the given path.
 * @param path The path to the offscreen document's HTML file.
 * @param reasons The reasons for creating the offscreen document.
 * @param justification A human-readable justification for creating the document.
 * @returns Promise<void>
 * @throws Error if creation fails or times out.
 */
async function createOffscreenDocument(
  path: string,
  reasons: chrome.offscreen.Reason[],
  justification: string
): Promise<void> {
  if (await hasOffscreenDocument(path)) {
    console.log(`[offscreenDocumentHelper] Offscreen document at ${path} already exists.`);
    return;
  }

  console.log(`[offscreenDocumentHelper] Creating offscreen document at ${path}...`);
  try {
    // Add a timeout for the creation process
    const creationPromise = chrome.offscreen.createDocument({
      url: path,
      reasons,
      justification,
    });

    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => {
        reject(new Error(`Timeout: Offscreen document creation for ${path} took too long.`));
      }, OFFSCREEN_DOCUMENT_CREATE_TIMEOUT_MS)
    );

    await Promise.race([creationPromise, timeoutPromise]);
    console.log(`[offscreenDocumentHelper] Offscreen document at ${path} created successfully.`);
  } catch (error) {
    const errorToLog = error instanceof Error ? error : new Error(String(error));
    // Construct a more detailed message for the error itself if Sentry wrapper doesn't take extra data
    const detailedErrorMessage = `Failed to create offscreen document ${path} (Reasons: ${reasons.join(", ")}, Justification: ${justification}): ${errorToLog.message}`;
    const finalError = new Error(detailedErrorMessage);
    finalError.cause = errorToLog; // Preserve original error cause if possible

    console.error(
      `[offscreenDocumentHelper] Error creating offscreen document at ${path}: ${errorToLog.message}`
    );
    logErrorToSentry(finalError, "error");
    throw new Error(`Failed to create offscreen document: ${errorToLog.message}`); // Throw original conciseness
  }
}

/**
 * Closes an offscreen document.
 * @param path The path to the offscreen document's HTML file.
 * @returns Promise<void>
 * @throws Error if closing fails.
 */
async function closeOffscreenDocument(path: string): Promise<void> {
  if (!(await hasOffscreenDocument(path))) {
    console.log(`[offscreenDocumentHelper] No offscreen document at ${path} to close.`);
    return;
  }
  console.log(`[offscreenDocumentHelper] Closing offscreen document at ${path}...`);
  try {
    await chrome.offscreen.closeDocument();
    console.log(`[offscreenDocumentHelper] Offscreen document at ${path} closed successfully.`);
  } catch (error) {
    const errorToLog = error instanceof Error ? error : new Error(String(error));
    const detailedErrorMessage = `Failed to close offscreen document ${path}: ${errorToLog.message}`;
    const finalError = new Error(detailedErrorMessage);
    finalError.cause = errorToLog;

    console.error(
      `[offscreenDocumentHelper] Error closing offscreen document at ${path}: ${errorToLog.message}`
    );
    logErrorToSentry(finalError, "error");
  }
}

/**
 * Ensures an offscreen document exists, creating it if necessary.
 * @param path The path to the offscreen document's HTML file.
 * @param reasons The reasons for creating the offscreen document.
 * @param justification A human-readable justification for creating the document.
 * @returns Promise<void>
 */
async function ensureOffscreenDocument(
  path: string,
  reasons: chrome.offscreen.Reason[],
  justification: string
): Promise<void> {
  if (await hasOffscreenDocument(path)) {
    return;
  }
  await createOffscreenDocument(path, reasons, justification);
}

/**
 * Sends a message to the offscreen document and returns its response.
 * Ensures the document is active before sending.
 * @param path The path to the offscreen document's HTML file (used for ensuring it exists).
 * @param reasons The reasons for creating the offscreen document if it doesn't exist.
 * @param justification A human-readable justification if creation is needed.
 * @param message The message to send to the offscreen document.
 * @param responseTimeoutMs Timeout for waiting for a response from the offscreen document.
 * @returns Promise<any> The response from the offscreen document.
 * @throws Error if sending message fails or response times out.
 */
async function sendMessageToOffscreenDocument<TResponse = any, TMessage = any>(
  path: string,
  reasons: chrome.offscreen.Reason[],
  justification: string,
  message: TMessage,
  responseTimeoutMs = 120000 // Default 2 minutes, as PDF OCR can be slow
): Promise<TResponse> {
  await ensureOffscreenDocument(path, reasons, justification);

  console.log("[offscreenDocumentHelper] Sending message to offscreen document:", message);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Timeout: No response from offscreen document for message action '${
            (message as any)?.action || "unknown" // Best effort to get action
          }' within ${responseTimeoutMs}ms.`
        )
      );
    }, responseTimeoutMs);

    chrome.runtime.sendMessage(message, (response: TResponse | { error?: string }) => {
      clearTimeout(timeoutId);
      if (chrome.runtime.lastError) {
        console.error(
          "[offscreenDocumentHelper] Error sending message to offscreen:",
          chrome.runtime.lastError.message
        );
        reject(new Error(chrome.runtime.lastError.message));
      } else if (
        response &&
        typeof response === "object" &&
        "error" in response &&
        response.error
      ) {
        console.warn(
          "[offscreenDocumentHelper] Offscreen document returned an error:",
          response.error
        );
        reject(new Error(String(response.error)));
      } else {
        console.log(
          "[offscreenDocumentHelper] Received response from offscreen document:",
          response
        );
        resolve(response as TResponse);
      }
    });
  });
}

export {
  closeOffscreenDocument,
  createOffscreenDocument,
  ensureOffscreenDocument,
  hasOffscreenDocument,
  sendMessageToOffscreenDocument,
};
