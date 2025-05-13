console.log(
  "[offscreen.ts] Offscreen document script loaded. Version 2 (with PDF OCR capability). TOP OF FILE TEST."
);
// src/offscreen/offscreen.ts
import { GovEpcCertificate } from "@/types/govEpcCertificate"; // Assuming this type path is correct from offscreen context
// Corrected import path for property types/enums
import { ActionEvents } from "../constants/actionEvents"; // Added for PDF OCR

// Re-importing these for the actual PDF processing later, but they aren't used by the uncommented GOV EPC part yet
import { DataStatus } from "../types/property"; // Keep for eventual PDF processing

console.log(
  "[offscreen.ts] Offscreen document script loaded. Version 2 (with PDF OCR and GOV EPC HTML parsing capabilities)."
);

// --- PDF OCR Message Handling (via chrome.runtime.onMessage) ---
interface BackgroundPdfOcrRequest {
  action: typeof ActionEvents.BACKGROUND_REQUEST_PDF_OCR | "DIRECT_DEBUG_PDF_OCR_TEST"; // Allow debug action
  payload: {
    pdfUrl: string;
    debugMarker?: string; // Optional for debug
  };
}

// This listener is for PDF OCR requests primarily
chrome.runtime.onMessage.addListener(
  (message: BackgroundPdfOcrRequest | any, sender, sendResponse) => {
    console.log("[Offscreen Document DEBUG] Received runtime message:", JSON.stringify(message));
    if (
      message.action === ActionEvents.BACKGROUND_REQUEST_PDF_OCR ||
      message.action === "DIRECT_DEBUG_PDF_OCR_TEST" // Handle original and debug action
    ) {
      console.log(
        `[Offscreen Document DEBUG] Runtime message listener: Matched action for PDF OCR or DEBUG. Action: ${message.action}, URL: ${message.payload?.pdfUrl}`
      );
      const testResponse = {
        status: DataStatus.IS_LOADING,
        action: ActionEvents.OFFSCREEN_PDF_OCR_RESULT, // Keep this consistent for background.ts if it were to process it
        testPayload: `Response from offscreen for action: ${message.action}`,
        receivedPdfUrl: message.payload?.pdfUrl,
        debugMarker: message.payload?.debugMarker,
      };
      console.log(
        "[Offscreen Document DEBUG] Sending hardcoded test response for PDF OCR/DEBUG path:",
        testResponse
      );
      sendResponse(testResponse);
      return true;
    }
    console.log(
      "[Offscreen Document DEBUG] Runtime message not for PDF OCR/DEBUG, action:",
      message.action,
      "returning false."
    );
    return false;
  }
);
// --- End PDF OCR Message Handling ---

// --- GOV.UK EPC HTML Parsing (via Port Connection) ---
interface OffscreenParseRequest {
  action: "OFFSCREEN_PARSE_EPC_HTML";
  htmlString: string;
  requestId: string;
}

const GOV_EPC_BASE_URL = "https://find-energy-certificate.service.gov.uk";
const PORT_NAME = "epc-offscreen-parser";

console.log(
  `[Offscreen Document] Setting up chrome.runtime.onConnect listener for port: ${PORT_NAME}`
);

chrome.runtime.onConnect.addListener((port) => {
  console.log(`[Offscreen Document] chrome.runtime.onConnect event fired. Port name: ${port.name}`);
  if (port.name === PORT_NAME) {
    console.log(
      `[Offscreen Document] Connection established on port: ${PORT_NAME} for GOV EPC HTML parsing.`
    );

    port.onMessage.addListener((message: OffscreenParseRequest | any) => {
      console.log(
        `[Offscreen Document] Port (${PORT_NAME}) received message:`,
        JSON.stringify(message).substring(0, 200) +
          (JSON.stringify(message).length > 200 ? "..." : "") // Log safely
      );
      if (message.action === "OFFSCREEN_PARSE_EPC_HTML") {
        const { htmlString, requestId } = message as OffscreenParseRequest;
        console.log(
          `[Offscreen Document] Received GOV EPC parse message on port ${PORT_NAME} for requestId: ${requestId}`
        );
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlString, "text/html");
          const resultsTable = doc.querySelector("table.govuk-table.epb-search-results");

          if (!resultsTable) {
            console.log(
              "[Offscreen Document] No EPC results table found (tried .epb-search-results)."
            );
            port.postMessage({ success: true, data: [], requestId });
            return;
          }

          const tableBody = resultsTable.querySelector("tbody");
          if (!tableBody) {
            console.log("[Offscreen Document] EPC results table has no body.");
            port.postMessage({ success: true, data: [], requestId });
            return;
          }

          const certificates: GovEpcCertificate[] = Array.from(
            tableBody.querySelectorAll("tr.govuk-table__row")
          )
            .map((row): GovEpcCertificate | null => {
              const addressAnchor = row.querySelector(
                "th.govuk-table__header a.govuk-link"
              ) as HTMLAnchorElement | null;
              const ratingCell = row.querySelector(
                "td.govuk-table__cell:nth-of-type(1)"
              ) as HTMLTableCellElement | null;
              const dateCell = Array.from(row.querySelectorAll("td.govuk-table__cell")).find(
                (td) => {
                  const text = td.textContent?.trim() || "";
                  return text.includes("Valid until") || text.includes("Expired");
                }
              ) as HTMLTableCellElement | null;

              if (!addressAnchor || !ratingCell) {
                console.warn(
                  "[Offscreen Document] Skipping row due to missing address or rating cell",
                  { htmlFragment: row.innerHTML }
                );
                return null;
              }

              const retrievedAddress = addressAnchor.textContent?.trim() || "Address not found";
              const certificateRelativeUrl = addressAnchor.getAttribute("href");
              const certificateUrl = certificateRelativeUrl
                ? `${GOV_EPC_BASE_URL}${certificateRelativeUrl}`
                : "URL not found";
              const retrievedRating = ratingCell.textContent?.trim() || null;

              let validUntil: string | null = null;
              let isExpired: boolean | undefined = undefined;

              if (dateCell) {
                const dateSpan = dateCell.querySelector("span:not([class])");
                const expiredTag = dateCell.querySelector("strong.govuk-tag--red");

                if (expiredTag) {
                  isExpired = true;
                  const expiryDateText = dateCell.textContent?.match(
                    /Expired on\s+((\d{1,2} \w+ \d{4}))/
                  );
                  if (expiryDateText && expiryDateText[1]) {
                    validUntil = expiryDateText[1];
                  } else {
                    const allTextContent = dateCell.textContent?.trim() || "";
                    const simpleDateMatch = allTextContent.match(/(\d{1,2} \w+ \d{4})/);
                    if (simpleDateMatch) validUntil = simpleDateMatch[0];
                  }
                } else if (dateSpan) {
                  validUntil = dateSpan.textContent?.trim().replace(/^Valid until\s+/, "") || null;
                  isExpired = false;
                } else {
                  const allTextContent = dateCell.textContent?.trim() || "";
                  const validUntilMatch = allTextContent.match(
                    /Valid until\s+((\d{1,2} \w+ \d{4}))/
                  );
                  if (validUntilMatch && validUntilMatch[1]) {
                    validUntil = validUntilMatch[1];
                    isExpired = false;
                  } else {
                    const simpleDateMatch = allTextContent.match(/(\d{1,2} \w+ \d{4})/);
                    if (simpleDateMatch) validUntil = simpleDateMatch[0];
                  }
                }
              }

              if (validUntil && isExpired === undefined) {
                try {
                  const dateParts = validUntil.split(" ");
                  if (dateParts.length === 3) {
                    const day = parseInt(dateParts[0], 10);
                    const monthName = dateParts[1];
                    const year = parseInt(dateParts[2], 10);
                    const monthNames = [
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December",
                    ];
                    const month = monthNames.findIndex(
                      (m) => m.toLowerCase() === monthName.toLowerCase()
                    );
                    if (day && month !== -1 && year) {
                      const expiryDate = new Date(year, month, day);
                      if (expiryDate < new Date()) {
                        isExpired = true;
                      }
                    }
                  }
                } catch (dateParseError) {
                  console.warn(
                    "[Offscreen Document] Could not parse date to check for expiry:",
                    validUntil,
                    dateParseError
                  );
                }
              }

              return {
                retrievedAddress,
                retrievedRating,
                certificateUrl,
                validUntil,
                isExpired,
              };
            })
            .filter((cert): cert is GovEpcCertificate => cert !== null);

          console.log(
            `[Offscreen Document] Successfully parsed ${certificates.length} certificates for GOV EPC requestId: ${requestId}. Posting back to port.`
          );
          port.postMessage({ success: true, data: certificates, requestId });
        } catch (error) {
          console.error("[Offscreen Document] Error parsing HTML for GOV EPC:", error);
          port.postMessage({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            requestId,
          });
        }
      } else {
        console.warn(
          `[Offscreen Document] Received unexpected action on GOV EPC port ${PORT_NAME}:`,
          message?.action
        );
        port.postMessage({
          success: false,
          error: `Unexpected action on port ${PORT_NAME}: ${message?.action}`,
          requestId: message?.requestId || "unknown_request_id",
        });
      }
    });

    port.onDisconnect.addListener(() => {
      console.log(`[Offscreen Document] GOV EPC Port ${PORT_NAME} disconnected.`);
    });
  } else {
    console.warn(
      `[Offscreen Document] Connection attempt on unexpected port name: ${port.name}. Expected: ${PORT_NAME}`
    );
  }
});

console.log(
  "[Offscreen Document] Script loaded. Listening for runtime messages and connections on port 'epc-offscreen-parser'."
);
