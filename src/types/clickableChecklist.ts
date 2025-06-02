import { CHECKLIST_KEYS, ChecklistKey } from "@/constants/checklistKeys";

// Define which keys are clickable using the constants
export type ClickableItemKey =
  | typeof CHECKLIST_KEYS.EPC
  | typeof CHECKLIST_KEYS.FLOOR_PLAN
  | typeof CHECKLIST_KEYS.CRIME_SCORE
  | typeof CHECKLIST_KEYS.PLANNING_PERMISSIONS
  | typeof CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS
  | typeof CHECKLIST_KEYS.MOBILE_COVERAGE
  | typeof CHECKLIST_KEYS.FLOOD_RISK;

// Define the array using constants
export const CLICKABLE_KEYS: ClickableItemKey[] = [
  CHECKLIST_KEYS.EPC,
  CHECKLIST_KEYS.FLOOR_PLAN,
  CHECKLIST_KEYS.CRIME_SCORE,
  CHECKLIST_KEYS.PLANNING_PERMISSIONS,
  CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS,
  CHECKLIST_KEYS.MOBILE_COVERAGE,
  CHECKLIST_KEYS.FLOOD_RISK,
];

// Update the type guard to accept ChecklistKey and use the constant array
export const checkIfClickableItemKey = (key: ChecklistKey): key is ClickableItemKey => {
  // The includes method works fine here because CLICKABLE_KEYS is typed as ClickableItemKey[]
  // and key is ChecklistKey. TypeScript can compare them.
  return CLICKABLE_KEYS.includes(key as ClickableItemKey); // Cast needed as includes expects the subset type
};
