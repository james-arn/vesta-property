import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { DASHBOARD_CATEGORY_DISPLAY_NAMES, DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import { checkIfClickableItemKey } from "@/types/clickableChecklist";
import { logErrorToSentry } from "@/utils/sentry";
import React from 'react';
import { DataStatus, PropertyDataListItem } from "../types/property";

export const getStatusIcon = (status: DataStatus): string | React.ReactNode => {
  switch (status) {
    case DataStatus.FOUND_POSITIVE:
      return "✅";
    case DataStatus.FOUND_NEGATIVE:
      return "❌";
    case DataStatus.ASK_AGENT:
      return "⚠️";
    case DataStatus.IS_LOADING:
      return <LoadingSpinner />
    case DataStatus.NOT_APPLICABLE:
      return "➖";
  }
};

export const getStatusColor = (status: DataStatus): string => {
  switch (status) {
    case DataStatus.FOUND_POSITIVE:
      return "green";
    case DataStatus.FOUND_NEGATIVE:
      return "red";
    case DataStatus.ASK_AGENT:
      return "orange";
    case DataStatus.IS_LOADING:
      return "gray";
    case DataStatus.NOT_APPLICABLE:
      return "black";
  }
};

export const filterChecklistToAllAskAgentOnlyItems = (
  checklist: PropertyDataListItem[]
): PropertyDataListItem[] => {
  return checklist.filter((item) => item.status === DataStatus.ASK_AGENT);
};

export function extractPropertyIdFromUrl(url: string): string | undefined {
  try {
    const parsedUrl = new URL(url);

    // Only process URLs that belong to a Rightmove domain.
    // This check ensures that even if there is a 'backToPropertyURL' query parameter,
    // we ignore it if the main URL is not from rightmove.
    if (!parsedUrl.hostname.endsWith("rightmove.co.uk")) {
      return undefined;
    }

    // Try to get propertyId from the query parameter.
    let propertyId = parsedUrl.searchParams.get("propertyId");
    if (propertyId) return propertyId;

    // Optionally, check a secondary parameter like backToPropertyURL.
    const backToPropertyURL = parsedUrl.searchParams.get("backToPropertyURL");
    if (backToPropertyURL) {
      const backUrl = new URL(backToPropertyURL, parsedUrl.origin);
      propertyId = backUrl.pathname.split("/").pop() ?? null;
      if (propertyId) return propertyId;
    }

    // Fallback: extract from the pathname (e.g. /properties/<id>).
    const pathMatch = parsedUrl.pathname.match(/\/properties\/(\d+)/);
    if (pathMatch) return pathMatch[1];
  } catch (error) {
    logErrorToSentry("Invalid URL in extractPropertyIdFromUrl: " + error);
  }
  return undefined;
}

export const getValueClickHandler = (
  item: PropertyDataListItem,
  openNewTab: (url: string) => void,
  toggleCrimeChart: () => void,
  togglePlanningPermissionCard: () => void,
  toggleNearbyPlanningPermissionCard: () => void,
  toggleMobileCoverageCard: () => void,
  toggleCoastalErosionCard: () => void,
  toggleFloodRiskCard: () => void
): void => {

  const { key, value } = item;
  if (!checkIfClickableItemKey(key)) {
    console.warn(`getValueClickHandler: Item key "${key}" is not registered as clickable.`);
    return;
  }

  switch (key) {
    case CHECKLIST_KEYS.EPC:
    case CHECKLIST_KEYS.FLOOR_PLAN:
      if (value) {
        openNewTab(String(value));
      } else {
        console.warn(`getValueClickHandler: No URL value provided for clickable item key "${key}".`);
      }
      break;
    case CHECKLIST_KEYS.CRIME_SCORE:
      toggleCrimeChart();
      break;
    case CHECKLIST_KEYS.PLANNING_PERMISSIONS:
      togglePlanningPermissionCard();
      break;
    case CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS:
      toggleNearbyPlanningPermissionCard();
      break;
    case CHECKLIST_KEYS.MOBILE_COVERAGE:
      toggleMobileCoverageCard();
      break;
    case CHECKLIST_KEYS.COASTAL_EROSION:
      toggleCoastalErosionCard();
      break;
    case CHECKLIST_KEYS.FLOOD_RISK:
      toggleFloodRiskCard();
      break;
    default:
      // This case should ideally not be reached if checkIfClickableItemKey is comprehensive
      // and all clickable keys are handled above.
      console.error(`getValueClickHandler: Clickable key "${key}" is not handled in the switch statement.`);
      break;
  }
};

export const generateAgentMessage = (checklist: PropertyDataListItem[]): string => {
  const askAgentItems = checklist.filter(
    (item) => item.status === DataStatus.ASK_AGENT && item.askAgentMessage
  );
  if (askAgentItems.length === 0) {
    return "No missing items identified to ask the agent about.";
  }
  const questions = askAgentItems.map((item) => `- ${item.askAgentMessage}`).join("\n");
  return `Regarding the property listing, could you please provide information on the following points?\n\n${questions}\n\nThank you.`;
};

export const getCategoryDisplayName = (category: DashboardScoreCategory): string => {
  return DASHBOARD_CATEGORY_DISPLAY_NAMES[category] || category.replace(/_/g, " ");
};
