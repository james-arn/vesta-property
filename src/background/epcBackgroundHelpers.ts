// THIS FILE IS USED IN BACKGORUND SCRIPT CONTEXT ONLY
import { logErrorToSentry } from "../utils/sentry";

export async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl || !imageUrl.startsWith("http")) {
    return null;
  }
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(
        `[fetchImageAsDataUrl] Failed to fetch image: ${response.status} ${response.statusText} for URL: ${imageUrl}`
      );
      return null;
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      console.warn(
        `[fetchImageAsDataUrl] Fetched content is not an image: ${blob.type} for URL: ${imageUrl}`
      );
      return null;
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = (error) => {
        console.error(`[fetchImageAsDataUrl] FileReader error for URL ${imageUrl}:`, error);
        reject(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[fetchImageAsDataUrl] Error fetching or converting image ${imageUrl}:`,
      errorMsg
    );
    logErrorToSentry(`[fetchImageAsDataUrl] Error for ${imageUrl}: ${errorMsg}`, "warning");
    return null;
  }
}

export async function convertEpcUrlToDataUrlIfHttp(
  originalEpcUrl: string | null | undefined,
  propertyId: string | null
): Promise<string | null | undefined> {
  if (!originalEpcUrl || !originalEpcUrl.startsWith("http")) {
    return originalEpcUrl;
  }

  console.log(
    `[BG EPC Image] Original EPC image URL is HTTP(S): ${originalEpcUrl}. Attempting conversion to data URL for property ${propertyId}.`
  );

  const dataUrl = await fetchImageAsDataUrl(originalEpcUrl);

  if (dataUrl) {
    console.log(
      `[BG EPC Image] Successfully converted EPC image URL to data URL for property ${propertyId}.`
    );
    return dataUrl;
  } else {
    console.warn(
      `[BG EPC Image] Failed to convert EPC image URL ${originalEpcUrl} to data URL. Original URL will be used.`
    );
    return originalEpcUrl;
  }
}
