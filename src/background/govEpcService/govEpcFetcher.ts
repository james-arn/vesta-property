import { GovEpcCertificate } from "@/types/govEpcCertificate";
import { logErrorToSentry } from "@/utils/sentry";

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html"; // Adjusted path to be relative for getURL
const PORT_NAME = "epc-offscreen-parser"; // Added port name constant

// A global promise to avoid racing createDocument calls
let creatingOffscreenDocumentPromise: Promise<void> | null = null;

async function hasOffscreenDocument(): Promise<boolean> {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  console.log(`[GovEpcFetcher] Checking for existing offscreen document at URL: ${offscreenUrl}`);
  try {
    const contextTypeForOffscreen =
      chrome.runtime.ContextType && (chrome.runtime.ContextType as any).OFFSCREEN_DOCUMENT
        ? (chrome.runtime.ContextType as any).OFFSCREEN_DOCUMENT
        : "OFFSCREEN_DOCUMENT";

    const contexts = await chrome.runtime.getContexts({
      contextTypes: [contextTypeForOffscreen as chrome.runtime.ContextType],
      documentUrls: [offscreenUrl],
    });
    const documentExists = contexts && contexts.length > 0;
    console.log(
      `[GovEpcFetcher] Offscreen document exists check result: ${documentExists}, contexts found:`,
      contexts
    );
    return documentExists;
  } catch (error) {
    console.error(
      `[GovEpcFetcher] Error checking for offscreen document (getContexts): ${error instanceof Error ? error.message : String(error)}. Assuming no document exists.`
    );
    return false;
  }
}

async function createOffscreenDocumentIfNeeded(): Promise<void> {
  console.log("[GovEpcFetcher] createOffscreenDocumentIfNeeded called.");
  if (await hasOffscreenDocument()) {
    console.log("[GovEpcFetcher] Offscreen document already exists. Skipping creation.");
    return;
  }

  if (creatingOffscreenDocumentPromise) {
    console.log(
      "[GovEpcFetcher] Offscreen document creation already in progress. Awaiting existing promise."
    );
    await creatingOffscreenDocumentPromise;
  } else {
    console.log(
      "[GovEpcFetcher] No existing offscreen document found and no creation in progress. Proceeding to create."
    );
    creatingOffscreenDocumentPromise = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "Parse HTML content from GOV.UK EPC Register for parsing.",
    });
    try {
      await creatingOffscreenDocumentPromise;
      console.log("[GovEpcFetcher] Offscreen document creation promise resolved successfully.");
    } catch (creationError) {
      console.error("[GovEpcFetcher] Error during offscreen document creation:", creationError);
      throw creationError; // Re-throw to allow callers to handle
    } finally {
      creatingOffscreenDocumentPromise = null;
    }
  }
}

// Function to send HTML to offscreen document and get back parsed data
async function parseHtmlViaOffscreen(htmlString: string): Promise<GovEpcCertificate[]> {
  await createOffscreenDocumentIfNeeded(); // Ensure document exists
  console.log("[GovEpcFetcher] Attempting to connect to offscreen document port:", PORT_NAME);

  const requestId = `epcParseRequest_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const TIMEOUT_MS = 20000; // 20 seconds timeout for offscreen document response via port

  return new Promise((resolve, reject) => {
    let port: chrome.runtime.Port | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      port = chrome.runtime.connect({ name: PORT_NAME });
      console.log("[GovEpcFetcher] Port connection initiated to:", PORT_NAME);

      const handleDisconnect = () => {
        if (timeoutId) clearTimeout(timeoutId);
        port = null; // Clear the port reference
        // Don't reject if already resolved/rejected by message or timeout
        // This primarily handles unexpected disconnects.
        console.warn("[GovEpcFetcher] Port disconnected unexpectedly.");
        // Consider if a specific error for unexpected disconnect is needed
        // reject(new Error("Port disconnected unexpectedly before response."));
      };

      port.onDisconnect.addListener(handleDisconnect);

      port.onMessage.addListener((response: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (port) port.onDisconnect.removeListener(handleDisconnect); // Clean up disconnect listener

        console.log(
          `[GovEpcFetcher] Received message from offscreen port for requestId ${response.requestId}:`,
          JSON.stringify(response)
        );

        if (response.requestId === requestId) {
          if (response.success && Array.isArray(response.data)) {
            console.log(
              "[GovEpcFetcher] Successfully received parsed certificates via port for requestId:",
              requestId
            );
            resolve(response.data as GovEpcCertificate[]);
          } else if (response.success && response.data === null) {
            console.log(
              "[GovEpcFetcher] Offscreen document parsed (via port), but no certificates found for requestId:",
              requestId
            );
            resolve([]);
          } else {
            const errorMsg = `Offscreen document (via port) failed for requestId: ${requestId}. Error: ${response.error || "Unknown error"}`;
            console.error("[GovEpcFetcher]", errorMsg, "Full response:", JSON.stringify(response));
            reject(new Error(errorMsg));
          }
          if (port) port.disconnect(); // Explicitly disconnect after processing the message
          port = null;
        } else {
          console.warn(
            `[GovEpcFetcher] Received message for unexpected requestId. Expected: ${requestId}, Got: ${response.requestId}`
          );
          // Do not resolve or reject, wait for the correct message or timeout
        }
      });

      console.log(`[GovEpcFetcher] Posting message to offscreen port for requestId ${requestId}:`, {
        action: "OFFSCREEN_PARSE_EPC_HTML",
        htmlString: "<preview>",
        requestId,
      });
      port.postMessage({
        action: "OFFSCREEN_PARSE_EPC_HTML",
        htmlString: htmlString,
        requestId: requestId,
      });

      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (port) {
          port.onDisconnect.removeListener(handleDisconnect);
          port.disconnect();
          port = null;
        }
        const timeoutErrorMsg = `Timeout waiting for response from offscreen document (via port) for requestId: ${requestId} after ${TIMEOUT_MS / 1000}s`;
        console.error("[GovEpcFetcher]", timeoutErrorMsg);
        reject(new Error(timeoutErrorMsg));
      }, TIMEOUT_MS);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const connectErrorMsg = `Error connecting to offscreen port ${PORT_NAME}: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[GovEpcFetcher]", connectErrorMsg);
      reject(new Error(connectErrorMsg));
    }
  });
}

export async function fetchGovEpcCertificatesByPostcode(
  postcode: string
): Promise<GovEpcCertificate[] | null> {
  const encodedPostcode = encodeURIComponent(postcode.toUpperCase().replace(/\s+/g, ""));
  const url = `https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodedPostcode}`;

  console.log(`[GovEpcFetcher] Fetching EPC certificates for postcode: ${postcode} from ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}. Response: ${errorText.substring(
          0,
          200
        )}`
      );
    }
    const htmlText = await response.text();

    // Send to offscreen document for parsing
    const parsedCertificates = await parseHtmlViaOffscreen(htmlText);

    // No longer a placeholder, parsedCertificates should be GovEpcCertificate[] or an empty array
    if (parsedCertificates) {
      console.log(
        `[GovEpcFetcher] Parsed ${parsedCertificates.length} certificates via offscreen document.`
      );
      return parsedCertificates;
    } else {
      // This case should ideally be handled by parseHtmlViaOffscreen throwing an error
      // or returning an empty array on parsing failure that results in null here.
      console.warn(
        "[GovEpcFetcher] parseHtmlViaOffscreen returned null/undefined, indicating a failure in parsing logic within offscreen document or communication."
      );
      return null; // Or [] depending on how you want to signal total failure vs. no results
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logErrorToSentry(`[GovEpcFetcher] Error during fetch or parsing: ${errorMessage}`, "error");
    return null;
  }
}

// Helper to extract date and calculate expiry - this can remain or be utility
// This function seems okay to stay here as it operates on string data
function extractValidUntil(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const match = dateString.match(/(\d{1,2} [A-Za-z]+ \d{4})/);
  return match ? match[1] : null;
}
