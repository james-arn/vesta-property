import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { DASHBOARD_CATEGORY_DISPLAY_NAMES, DashboardScoreCategory } from "@/constants/dashboardConsts";
import { isClickableItemKey } from "@/types/clickableChecklist";
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
  toggleNearbyPlanningPermissionCard?: () => void): (() => void) | undefined => {

  const { key, value } = item;
  if (!isClickableItemKey(key)) return undefined;

  switch (key) {
    case "epc":
    case "floorPlan":
      return () => openNewTab(String(value));
    case "crimeScore":
      return toggleCrimeChart;
    case "planningPermissions":
      return togglePlanningPermissionCard;
    case "nearbyPlanningPermissions":
      return toggleNearbyPlanningPermissionCard || (() => console.error("No handler provided for nearbyPlanningPermissions click"));
    default:
      console.error(`getValueClickHandler: Clickable key "${key}" is not handled in the switch statement.`);
      return undefined;
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
