import { debounce } from "../debounce";
import GA_EVENT_NAMES from "./googleAnalyticsConsts";
import { sendGA4Event } from "./googleAnalyticsHelpers";

interface PropertyAnalysedParams {
  property_id: string;
  property_address: string;
}

interface UpgradeButtonClickedParams {
  button_location: string;
  property_id?: string;
}

interface TokenUsedParams {
  property_id: string;
}

/**
 * 1. Tracks the first installation and opening of the extension.
 */
export const trackGA4ExtensionInstall = debounce(async () => {
  try {
    await sendGA4Event(GA_EVENT_NAMES.EXTENSION_INSTALL, {});
    console.log("GA Event: Extension Install sent.");
  } catch (error) {
    console.error("Error tracking extension install:", error);
  }
});

/**
 * 2. Tracks when a unique property is analysed by the user (free tier).
 * @param params - Parameters for the event, requires property_id.
 */
export const trackGA4PropertyAnalysed = debounce(async (params: PropertyAnalysedParams) => {
  try {
    await sendGA4Event(GA_EVENT_NAMES.PROPERTY_ANALYSED, params);
    console.log("GA Event: Property Analysed sent for", params.property_id);
  } catch (error) {
    console.error("Error tracking property analysed:", error);
  }
});

/**
 * Tracks when a user clicks on an upgrade/subscribe button.
 * @param params - Parameters for the event, requires button_location.
 */
export const trackGA4UpgradeButtonClicked = debounce(async (params: UpgradeButtonClickedParams) => {
  try {
    await sendGA4Event(GA_EVENT_NAMES.UPGRADE_BUTTON_CLICKED, params);
    console.log("GA Event: Upgrade Button Clicked sent from", params.button_location);
  } catch (error) {
    console.error("Error tracking upgrade button clicked:", error);
  }
});

/**
 * Tracks when a user successfully uses a token (e.g., for a deep search).
 * This is distinct from the initial purchase event.
 * @param params - Parameters for the event, requires property_id.
 */
export const trackGA4TokenUsed = debounce(async (params: TokenUsedParams) => {
  try {
    const eventParams = {
      ...params,
    };
    await sendGA4Event(GA_EVENT_NAMES.TOKEN_USED, eventParams);
    console.log(`GA Event: Token Used for property ${params.property_id}`);
  } catch (error) {
    console.error("Error tracking token used event:", error);
  }
});

interface FeedbackSelectedParams {
  type: "happy" | "medium" | "sad";
}

export const trackGA4FeedbackSelected = debounce(async (params: FeedbackSelectedParams) => {
  try {
    await sendGA4Event(GA_EVENT_NAMES.FEEDBACK_SELECTED, params);
    console.log("GA Event: Feedback Selected sent for", params.type);
  } catch (error) {
    console.error("Error tracking feedback selected:", error);
  }
});
