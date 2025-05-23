import { EPC_CURRENT_RATING_REGEX, EPC_POTENTIAL_RATING_REGEX } from "@/constants/regex";
import * as pdfjsLib from "pdfjs-dist";

// --- PDF.js Configuration ---

// Configure pdfjs-dist worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.mjs");

/**
 * Checks if a given URL string ends with '.pdf' (case-insensitive).
 */
export const isPdfUrl = (url: string | null | undefined): boolean => {
  return !!url && url.toLowerCase().endsWith(".pdf");
};

/**
 * Interface for the extracted EPC data.
 */
export interface ExtractedEpcData {
  fullAddress: string | null;
  currentEpcRating: string | null; // e.g., "C"
  potentialEpcRating: string | null; // e.g., "B"
}

/**
 * Renders the first page of a PDF from a URL to a canvas and returns its data URL.
 *
 * @param pdfUrl The URL of the PDF file.
 * @returns The data URL (e.g., "data:image/png;base64,...") of the rendered page, or null if an error occurs.
 */
export const renderPdfPageToDataUrl = async (pdfUrl: string): Promise<string | null> => {
  try {
    // 1. Fetch the PDF document using pdfjs-dist
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    // 2. Get the first page
    const page = await pdf.getPage(1);

    // 3. Render the page to an in-memory canvas
    const viewport = page.getViewport({ scale: 2.0 }); // Use a good scale for clarity
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      console.error("Could not get canvas context for PDF rendering");
      return null;
    }
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;

    // 4. Get the data URL from the canvas
    // Use PNG for better quality than JPEG, though larger size
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl;
  } catch (error) {
    console.error("Error rendering PDF page to data URL:", error);
    return null;
  }
  // No finally block needed here as there's no worker to terminate
};

/**
 * Extracts specific EPC data (address, ratings) from raw text using regex.
 * IMPORTANT: This function now needs to be EXPORTED for use in useEpcProcessor.
 *
 * @param text The raw text extracted from the EPC PDF page (received from background).
 * @param domPostcode The postcode hint provided by the DOM.
 * @param domDisplayAddress The display address hint provided by the DOM.
 * @returns An object containing the extracted data, or null values if not found.
 */
export const extractAddressAndPdfDataFromText = (
  text: string,
  // domPostcode and domDisplayAddress are no longer used but kept for type consistency if called elsewhere
  domPostcode?: string | null,
  domDisplayAddress?: string | null
): ExtractedEpcData => {
  // Address OCR from GOV.UK PDFs has proven unreliable due to varied formatting
  // and the quality of OCR text. Focus is now solely on EPC rating extraction.
  const extractedData: ExtractedEpcData = {
    fullAddress: null, // Address extraction removed
    currentEpcRating: null,
    potentialEpcRating: null,
  };

  if (!text) {
    console.warn("[pdfProcessingUtils] No text provided for EPC data extraction.");
    return extractedData;
  }

  // Log the raw text for debugging
  // Using JSON.stringify to see newlines as \n, etc.
  console.log("[pdfProcessingUtils] Raw OCR Text for EPC Extraction:", JSON.stringify(text));

  // --- Current EPC Rating Extraction ---
  // Looks for "This property's energy rating is X." where X is a letter A-G.
  const currentRatingMatch = text.match(EPC_CURRENT_RATING_REGEX);

  if (currentRatingMatch && currentRatingMatch[1]) {
    extractedData.currentEpcRating = currentRatingMatch[1].toUpperCase();
  } else {
    console.warn("[pdfProcessingUtils] Could not extract current EPC rating using primary regex.");
    // Optional: Add more fallback regexes here if needed for other phrasings
  }

  // --- Potential EPC Rating Extraction ---
  // Looks for "potential to be X." where X is a letter A-G.
  const potentialRatingMatch = text.match(EPC_POTENTIAL_RATING_REGEX);

  if (potentialRatingMatch && potentialRatingMatch[1]) {
    extractedData.potentialEpcRating = potentialRatingMatch[1].toUpperCase();
  } else {
    console.warn(
      "[pdfProcessingUtils] Could not extract potential EPC rating using primary regex."
    );
    // Optional: Add more fallback regexes here if needed for other phrasings
  }

  console.log("[pdfProcessingUtils] Final Extracted EPC Data (ratings only):", extractedData);
  return extractedData;
};
