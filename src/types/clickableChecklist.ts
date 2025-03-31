export type ClickableItemKey =
  | "epc"
  | "floorPlan"
  | "crimeScore"
  | "planningPermissions"
  | "nearbyPlanningPermissions";

export const CLICKABLE_KEYS: ClickableItemKey[] = [
  "epc",
  "floorPlan",
  "crimeScore",
  "planningPermissions",
  "nearbyPlanningPermissions",
];

export const isClickableItemKey = (key: string): key is ClickableItemKey => {
  const result = CLICKABLE_KEYS.includes(key as ClickableItemKey);

  // Log error if the key should be clickable but isn't in our list
  if (
    !result &&
    (key === "epc" ||
      key === "floorPlan" ||
      key === "crimeScore" ||
      key === "planningPermissions" ||
      key === "nearbyPlanningPermissions")
  ) {
    console.error(`Key "${key}" appears to be clickable but is not defined in CLICKABLE_KEYS`);
  }

  return result;
};
