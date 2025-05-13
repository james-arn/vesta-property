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
    potentialEpcRating: null, // We might not always get this from simpler OCR
  };

  if (!text) {
    return extractedData;
  }

  // Normalize text: replace multiple newlines/spaces with single ones for easier regex
  const normalizedText = text.replace(/\s*\n\s*/g, "\\n").replace(/\s+/g, " ");

  // --- Address Extraction ---
  // Try to find a line that looks like an address, often preceding "Valid until" or "Certificate number"
  // And usually after "Energy performance certificate (EPC)"
  // This is a bit more flexible.
  // Look for lines starting with a number/letter (address part) followed by a Town and Postcode.
  // Adjusted to be less reliant on "Energy performance certificate (EPC)" being immediately before.
  const addressBlockRegex =
    /(?:Energy performance certificate \(EPC\))?[\s\S]*?(\d+[\s\S]*?[A-Z]{1,2}[0-9R][0-9A-Z]?\s*[0-9][A-Z]{2})/i;
  // Fallback: Try to capture lines that look like address components if the above is too strict
  // This regex looks for typical address lines possibly ending with a postcode or town.
  const looserAddressRegex =
    /^(\d+[\s\w,.-]+?)\n([\w\s,.-]+?)\n([A-Z]{1,2}[0-9R][0-9A-Z]?\s*[0-9][A-Z]{2})/im;

  let addressMatch = normalizedText.match(addressBlockRegex);
  if (addressMatch && addressMatch[1]) {
    let rawAddress = addressMatch[1].trim();
    // Further clean up by removing "Energy rating", "Valid until", "Certificate number" and their values
    rawAddress = rawAddress.replace(/Energy rating.*?(\\n|$)/i, "").trim();
    rawAddress = rawAddress.split(/Valid until:|Certificate number:/i)[0].trim();
    // Remove any trailing EPC rating letters if they got caught
    rawAddress = rawAddress.replace(/\s+[A-G]$/i, "").trim();
    extractedData.fullAddress = rawAddress;
  } else {
    addressMatch = text.match(looserAddressRegex); // Use original text for multiline match
    if (addressMatch) {
      extractedData.fullAddress = `${addressMatch[1].trim()}, ${addressMatch[2].trim()}, ${addressMatch[3].trim()}`;
    } else {
      console.warn(
        "Could not reliably extract address from EPC text using primary or looser regex."
      );
    }
  }

  // --- Rating Extraction ---
  // Look for "Energy rating D" or "Rating D" or "Current rating D" etc.
  // The OCR text has "FLEES D" - this is tricky.
  // Let's try to find a letter A-G that's likely an EPC rating.
  // Pattern: "Energy rating" followed by any characters (non-greedy) then a space and a single letter A-G.
  const currentRatingRegex =
    /(?:Energy\s+rating|Current\s+Rating|Rating)\s*.*?([A-G])(?=\s|$|\\n|\|)/i;
  let ratingMatch = normalizedText.match(currentRatingRegex);

  if (ratingMatch && ratingMatch[1]) {
    extractedData.currentEpcRating = ratingMatch[1].toUpperCase();
  } else {
    // Fallback: Look for a standalone letter (A-G) possibly near words like "rating" or before "Certificate number" if OCR missed "Energy rating"
    // This is more speculative and might need refinement based on more OCR examples.
    // Example: "FLEES D" in your OCR text, or if it was just "D" on a line.
    const fallbackRatingRegex =
      /(?:[A-Z]{2,}\s+)?([A-G])(?=\s*(?:Certificate number|Valid until|\\n|$))/i;
    ratingMatch = normalizedText.match(fallbackRatingRegex);
    if (ratingMatch && ratingMatch[1]) {
      extractedData.currentEpcRating = ratingMatch[1].toUpperCase();
      console.warn("Extracted current rating using a more general fallback regex.");
    } else {
      console.warn("Could not extract current EPC rating from text.");
    }
  }

  // Potential rating is often harder to get reliably from diverse PDF formats without a clear sentence structure.
  // For now, we'll leave it as potentially null if not found by a very clear pattern.
  const potentialRatingRegex = /potential\s*(?:to\s*be|rating\s*is)?\s*([A-G])/i;
  const potentialMatch = normalizedText.match(potentialRatingRegex);
  if (potentialMatch && potentialMatch[1]) {
    extractedData.potentialEpcRating = potentialMatch[1].toUpperCase();
  }

  // Final cleanup for address if it looks like it only got street and needs town/postcode added back if separately found
  if (extractedData.fullAddress && extractedData.fullAddress.split(",").length < 2) {
    const postcodeRegex = /([A-Z]{1,2}[0-9R][0-9A-Z]?\s*[0-9][A-Z]{2})/i;
    const pcMatch = normalizedText.match(postcodeRegex);
    if (pcMatch && pcMatch[1] && !extractedData.fullAddress.includes(pcMatch[1])) {
      // Simplistic append, assumes town might be before postcode in normalized text if address is too short
      // This part is highly heuristic
      const townAndPostcodeCandidate = normalizedText
        .substring(0, pcMatch.index)
        .split("\\n")
        .pop()
        ?.trim();
      if (
        townAndPostcodeCandidate &&
        !extractedData.fullAddress.includes(townAndPostcodeCandidate)
      ) {
        extractedData.fullAddress += `, ${townAndPostcodeCandidate}`;
      }
      extractedData.fullAddress += `, ${pcMatch[1]}`;
      extractedData.fullAddress = extractedData.fullAddress.replace(/,\s*,/g, ",").trim(); // clean up double commas
    }
  }

  console.log("[pdfProcessingUtils] Final Extracted EPC Data:", extractedData);
  return extractedData;
};
