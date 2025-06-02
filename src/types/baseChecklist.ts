import { PropertyDataListItem } from "./property";

export type BaseChecklistListItem = Pick<
  PropertyDataListItem,
  "label" | "key" | "checklistGroup" | "isExpectedInPremiumSearchData" | "isExpectedInListing"
>;
