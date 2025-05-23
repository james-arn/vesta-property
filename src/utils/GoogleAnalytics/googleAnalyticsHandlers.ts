import { trackGA4PropertyAnalysed } from "./googleAnalyticsEvents";
import { isNewPropertyAnalysisThisSession } from "./googleAnalyticsHelpers";

/**
 * Handles the logic for tracking a property analysis event to Google Analytics,
 * including checking for session uniqueness.
 * @param propertyId The ID of the property that was analysed.
 * @param propertyAddress The address of the property that was analysed.
 */
export async function handleTrackPropertyAnalysisForGA(
  propertyId: string,
  propertyAddress: string
): Promise<void> {
  try {
    const isNewProperty = await isNewPropertyAnalysisThisSession(propertyId);
    if (isNewProperty) {
      const gaParams = {
        property_id: propertyId,
        property_address: propertyAddress,
      };
      await trackGA4PropertyAnalysed(gaParams);
      console.log(`GA Event: Property Analysed triggered for new property ID: ${propertyId}`);
    } else {
      console.log(
        `GA Event: Property ID ${propertyId} already analysed this session. Not re-tracking.`
      );
    }
    return Promise.resolve();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Consider if Sentry logging is appropriate here or if console.error is sufficient
    // for a non-critical analytics event pathway.
    console.error("Error processing property analysed GA event:", errorMsg);
    return Promise.reject(error);
  }
}
