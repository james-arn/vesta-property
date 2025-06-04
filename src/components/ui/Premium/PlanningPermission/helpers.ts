import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { PREMIUM_DATA_STATES } from "@/constants/propertyConsts";
import { NearbyPlanningApplication, PlanningApplication } from "@/types/premiumStreetData";
import { DataStatus } from "@/types/property";

/**
 * Determines the status of property planning applications data
 */
export const getPropertyPlanningApplicationsStatus = (
  planningApplications: PlanningApplication[] | null | undefined,
  isPremiumDataFetchedAndHasData: boolean | undefined
) => {
  if (!isPremiumDataFetchedAndHasData) return DataStatus.NOT_APPLICABLE;
  if (!planningApplications) return DataStatus.ASK_AGENT;

  return planningApplications.length > 0 ? DataStatus.ASK_AGENT : DataStatus.FOUND_POSITIVE;
};

/**
 * Determines the status of nearby planning applications data
 */
export const getNearbyPlanningApplicationsStatus = (
  nearbyPlanningApplications: NearbyPlanningApplication[] | null | undefined
) => {
  if (!nearbyPlanningApplications) {
    return DataStatus.NOT_APPLICABLE;
  }

  return nearbyPlanningApplications.length > 0
    ? DataStatus.FOUND_POSITIVE
    : DataStatus.NOT_APPLICABLE;
};

/**
 * Gets the value to display for property planning applications
 */
export const getPropertyPlanningApplicationsValue = (
  planningApplications: PlanningApplication[] | null | undefined
) => {
  if (!planningApplications || planningApplications.length === 0) {
    return PREMIUM_DATA_STATES.NO_APPLICATIONS;
  }

  return `${planningApplications.length} application${
    planningApplications.length !== 1 ? "s" : ""
  } found`;
};

/**
 * Gets the value to display for nearby planning applications
 */
export const getNearbyPlanningApplicationsValue = (
  nearbyPlanningApplications: NearbyPlanningApplication[] | null | undefined
) => {
  if (!nearbyPlanningApplications) {
    return PREMIUM_DATA_STATES.NOT_FOUND;
  }

  if (nearbyPlanningApplications.length === 0) {
    return PREMIUM_DATA_STATES.NO_NEARBY_APPLICATIONS;
  }

  return `${nearbyPlanningApplications.length} nearby application${
    nearbyPlanningApplications.length !== 1 ? "s" : ""
  } found`;
};

/**
 * Gets planning applications value (combined property and nearby)
 * @deprecated Use the specific functions for property and nearby instead
 */
export const getPlanningApplicationsValue = (
  planningApplications: PlanningApplication[] | null | undefined,
  nearbyPlanningApplications: NearbyPlanningApplication[] | null | undefined
) => {
  if (!planningApplications && !nearbyPlanningApplications) {
    return PREMIUM_DATA_STATES.NOT_FOUND;
  }

  const propertyCount = planningApplications?.length || 0;
  const nearbyCount = nearbyPlanningApplications?.length || 0;
  const totalCount = propertyCount + nearbyCount;

  if (totalCount === 0) {
    return PREMIUM_DATA_STATES.NO_APPLICATIONS;
  }

  return `${totalCount} application${totalCount !== 1 ? "s" : ""} found`;
};

/**
 * Gets planning applications status (combined property and nearby)
 * @deprecated Use the specific functions for property and nearby instead
 */
export const getPlanningApplicationsStatus = (
  planningApplications: PlanningApplication[] | null | undefined,
  nearbyPlanningApplications: NearbyPlanningApplication[] | null | undefined
) => {
  if (!planningApplications && !nearbyPlanningApplications) {
    return "Not found";
  }

  const propertyCount = planningApplications?.length || 0;
  const nearbyCount = nearbyPlanningApplications?.length || 0;
  const totalCount = propertyCount + nearbyCount;

  return totalCount > 0 ? "Found" : "No data";
};

export const formatDistance = (distance: number | null | undefined): string => {
  if (distance === null || distance === undefined) {
    return CHECKLIST_NO_VALUE.NOT_FOUND;
  }
  if (distance < 1) {
    const meters = Math.round(distance * 1000);
    return `${meters} m`;
  }
  return `${distance.toFixed(1)} km`;
};
