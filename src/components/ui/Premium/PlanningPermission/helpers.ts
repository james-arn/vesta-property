import { NearbyPlanningApplication, PlanningApplication } from "@/types/premiumStreetData";
import { DataStatus } from "@/types/property";

export function getPlanningApplicationsStatus(
  isPremiumStreetDataLoading: boolean,
  planningApplicationsData?: PlanningApplication[] | null,
  nearbyPlanningApplicationsData?: NearbyPlanningApplication[] | null
): DataStatus {
  if (isPremiumStreetDataLoading) {
    return DataStatus.IS_LOADING;
  }
  if (planningApplicationsData?.length && planningApplicationsData.length > 0) {
    return DataStatus.ASK_AGENT;
  }
  if (nearbyPlanningApplicationsData?.length && nearbyPlanningApplicationsData.length > 0) {
    return DataStatus.ASK_AGENT;
  }
  return DataStatus.FOUND_POSITIVE;
}

export function getPlanningApplicationsValue(
  isPremiumStreetDataLoading: boolean,
  planningApplicationsData?: PlanningApplication[] | null,
  nearbyPlanningApplicationsData?: NearbyPlanningApplication[] | null,
  premiumStreetDataError?: Error | null
): string {
  if (isPremiumStreetDataLoading) {
    return "Calculating...";
  }
  if (premiumStreetDataError) {
    return "Unable to find, check with agent";
  }

  const hasPlanningApplications =
    planningApplicationsData?.length && planningApplicationsData.length > 0;
  const hasNearbyPlanningApplications =
    nearbyPlanningApplicationsData?.length && nearbyPlanningApplicationsData.length > 0;

  if (hasPlanningApplications && hasNearbyPlanningApplications) {
    return "Planning applications on-premise and nearby found";
  }
  if (hasPlanningApplications) {
    return "Planning applications found";
  }
  if (hasNearbyPlanningApplications) {
    return "Nearby planning applications found";
  }
  return "Unable to find, check with agent";
}
