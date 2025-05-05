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
 * @returns An object containing the extracted data, or null values if not found.
 */
export const extractAddressAndPdfDataFromText = (text: string): ExtractedEpcData => {
  const extractedData: ExtractedEpcData = {
    fullAddress: null,
    currentEpcRating: null,
    potentialEpcRating: null,
  };

  if (!text) {
    return extractedData;
  }

  // --- Address Extraction ---
  const addressRegex =
    /Energy performance certificate \(EPC\)[\s\n]*([\s\S]*?\n([A-Z]{1,2}[0-9R][0-9A-Z]?\s*[0-9][A-Z]{2}))/i;
  const addressMatch = text.match(addressRegex);
  if (addressMatch && addressMatch[1]) {
    extractedData.fullAddress = addressMatch[1]
      .trim()
      .replace(/^Energy performance certificate \(EPC\)\s*/i, "")
      .trim();
    extractedData.fullAddress = extractedData.fullAddress
      .split(/Valid until:|Certificate number:/i)[0]
      .trim();
  } else {
    console.warn("Could not reliably extract address from EPC text.");
  }

  // --- Rating Extraction ---
  const ratingRegex = /energy rating is\s*([A-G])\s*\.\s*It has the\s*potential to be\s*([A-G])/i;
  const ratingMatch = text.replace(/\n/g, " ").match(ratingRegex);

  if (ratingMatch && ratingMatch[1] && ratingMatch[2]) {
    extractedData.currentEpcRating = ratingMatch[1].toUpperCase();
    extractedData.potentialEpcRating = ratingMatch[2].toUpperCase();
  } else {
    console.warn("Could not extract ratings using primary pattern. Trying fallback...");
    const tableRatingRegex = /(\d+)\s+([A-G])\s+(\d+)\s+([A-G])/i;
    const tableMatch = text.match(tableRatingRegex);
    if (tableMatch && tableMatch[2] && tableMatch[4]) {
      extractedData.currentEpcRating = tableMatch[2].toUpperCase();
      extractedData.potentialEpcRating = tableMatch[4].toUpperCase();
      console.warn("Extracted ratings using fallback table pattern.");
    } else {
      console.warn("Could not extract current and potential ratings from EPC text.");
    }
  }

  return extractedData;
};
