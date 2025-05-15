import { AddressLookupResultMessage } from "@/types/messages";
import { RightmovePageModelType } from "@/types/rightmovePageModel";
import { ActionEvents } from "../../constants/actionEvents";
import {
  INITIAL_EPC_RESULT_STATE,
  processEpcData,
  processPdfUrl,
  type EpcProcessorResult,
} from "../../lib/epcProcessing";
import { DataStatus } from "../../types/property";
import {
  handleAddressLookupResult,
  handlePageModelAvailable,
  handlePageModelTimeout,
  handleTabOrNavigationUpdate,
} from "../contentScriptHandlers";

// Sets up event listeners for the content script
export function setupContentScriptEventListeners() {
  // Listener for messages from the injected script (injectScript.js)
  window.addEventListener("message", async (event: MessageEvent) => {
    // Log ALL messages from window source to see if injectScript is posting
    // if (event.source === window && event.data?.type) {
    //   console.log(`[CS windowListener] Received message type: ${event.data.type}`, event.data);
    // }

    if (event.source !== window || !event.data) {
      return;
    }

    // Call handlers from the helper module
    if (event.data.type === ActionEvents.PAGE_MODEL_AVAILABLE) {
      // console.log(
      //   "[CS windowListener] PAGE_MODEL_AVAILABLE received, calling handlePageModelAvailable."
      // ); // Log before calling handler
      handlePageModelAvailable(event.data.pageModel as RightmovePageModelType);
    } else if (event.data.type === "pageModelTimeout") {
      handlePageModelTimeout(event.data.url as string);
    }
  });

  // Listener for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // console.log(
    //   "[ContentScript Listener] Received message from background:",
    //   request.action || request.type, // Log type for address lookup
    //   request.data || request.payload // Log payload for address lookup
    // );

    // Call handlers from the helper module
    if (request.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
      handleTabOrNavigationUpdate(request.data as string);
      // No async response needed from this handler normally
      return false;
    }
    // Use request.type for address lookup result
    else if (request.type === ActionEvents.ADDRESS_LOOKUP_RESULT) {
      handleAddressLookupResult((request as AddressLookupResultMessage).payload);
      // Indicate potential async response, although handler might be sync
      sendResponse({ status: "Address lookup result processing attempted." });
      return true;
    }
    // Handle PDF OCR requests from the background script
    else if (request.action === ActionEvents.BACKGROUND_REQUESTS_CLIENT_PDF_OCR) {
      console.log(
        "[CS runtimeListener] Received BACKGROUND_REQUESTS_CLIENT_PDF_OCR",
        request.payload
      );
      const { pdfUrl, requestId, domPostcode, domDisplayAddress } = request.payload as {
        pdfUrl: string;
        requestId: string;
        domPostcode?: string | null;
        domDisplayAddress?: string | null;
      };

      if (!pdfUrl || !requestId) {
        const errorMsg = "Missing pdfUrl or requestId for BACKGROUND_REQUESTS_CLIENT_PDF_OCR";
        console.error("[CS runtimeListener]", errorMsg);
        chrome.runtime.sendMessage({
          action: ActionEvents.CLIENT_PDF_OCR_RESULT,
          payload: {
            requestId,
            result: {
              ...INITIAL_EPC_RESULT_STATE,
              url: pdfUrl,
              status: DataStatus.FOUND_NEGATIVE,
              error: errorMsg,
              isLoading: false,
            } as EpcProcessorResult,
          },
        });
        return false;
      }

      processPdfUrl(pdfUrl, domPostcode, domDisplayAddress)
        .then((ocrResult: EpcProcessorResult) => {
          console.log("[CS runtimeListener] PDF OCR processed. Result:", ocrResult);
          chrome.runtime.sendMessage({
            action: ActionEvents.CLIENT_PDF_OCR_RESULT,
            payload: { requestId, result: ocrResult },
          });
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[CS runtimeListener] Error processing PDF for OCR:", errorMessage);
          chrome.runtime.sendMessage({
            action: ActionEvents.CLIENT_PDF_OCR_RESULT,
            payload: {
              requestId,
              result: {
                ...INITIAL_EPC_RESULT_STATE,
                url: pdfUrl,
                status: DataStatus.FOUND_NEGATIVE,
                error: `Client-side PDF processing failed: ${errorMessage}`,
                isLoading: false,
              } as EpcProcessorResult,
            },
          });
        });
      return true; // Indicate that sendResponse will be called asynchronously
    }
    // Handle IMAGE OCR requests from the background script
    else if (request.action === ActionEvents.BACKGROUND_REQUESTS_CLIENT_IMAGE_OCR) {
      console.log(
        "[CS runtimeListener] Received BACKGROUND_REQUESTS_CLIENT_IMAGE_OCR",
        request.payload
      );
      const { fileUrl, requestId } = request.payload as {
        fileUrl: string;
        requestId: string;
        // domPostcode and domDisplayAddress are not typically used by processEpcData for images directly
      };

      if (!fileUrl || !requestId) {
        const errorMsg = "Missing fileUrl or requestId for BACKGROUND_REQUESTS_CLIENT_IMAGE_OCR";
        console.error("[CS runtimeListener]", errorMsg);
        chrome.runtime.sendMessage({
          action: ActionEvents.CLIENT_PDF_OCR_RESULT, // Reusing this result action
          payload: {
            requestId,
            result: {
              ...INITIAL_EPC_RESULT_STATE,
              url: fileUrl,
              status: DataStatus.FOUND_NEGATIVE,
              error: errorMsg,
              isLoading: false,
            } as EpcProcessorResult,
          },
        });
        return false; // Synchronous response (error)
      }

      // Call processEpcData which will internally call processImageUrl
      processEpcData(fileUrl) // domPostcode, domDisplayAddress are not passed here as processEpcData for images doesn't use them directly
        .then((ocrResult: EpcProcessorResult) => {
          console.log("[CS runtimeListener] Image OCR processed. Result:", ocrResult);
          chrome.runtime.sendMessage({
            action: ActionEvents.CLIENT_PDF_OCR_RESULT, // Reusing this result action
            payload: { requestId, result: ocrResult },
          });
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[CS runtimeListener] Error processing Image for OCR:", errorMessage);
          chrome.runtime.sendMessage({
            action: ActionEvents.CLIENT_PDF_OCR_RESULT, // Reusing this result action
            payload: {
              requestId,
              result: {
                ...INITIAL_EPC_RESULT_STATE,
                url: fileUrl,
                status: DataStatus.FOUND_NEGATIVE,
                error: `Client-side Image processing failed: ${errorMessage}`,
                isLoading: false,
              } as EpcProcessorResult,
            },
          });
        });
      return true; // Indicate that sendResponse will be called asynchronously
    }

    // Handle other potential messages if necessary

    // Default: No specific handler matched, no async response
    return false;
  });
}
