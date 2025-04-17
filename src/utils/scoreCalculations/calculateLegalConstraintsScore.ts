import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import {
  CATEGORY_ITEM_MAP,
  DashboardScoreCategory,
} from "@/constants/dashboardScoreCategoryConsts";
import { LEGAL_CONSTRAINT_POINTS } from "@/constants/scoreConstants";
import {
  CategoryScoreData,
  DataStatus,
  PropertyDataListItem,
  RightOfWayDetails,
} from "@/types/property";
import { findItemByKey, getItemValue } from "@/utils/parsingHelpers";
import {
  calculateLegalPointsForStatus,
  calculateTenureConstraintPoints,
  getLegalConstraintsLabel,
} from "./helpers/legalContraintsProcessingHelpers";

interface CalculationData {
  calculatedLeaseMonths: number | null;
}
// --- Main Calculation Function ---
export const calculateLegalConstraintsScore = (
  items: PropertyDataListItem[],
  calculationData: CalculationData
): CategoryScoreData | undefined => {
  const contributingFactorKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.LEGAL_CONSTRAINTS] || [];
  const contributingItems = items.filter((item) => contributingFactorKeys.includes(item.key));

  if (contributingItems.length === 0 && !calculationData.calculatedLeaseMonths) {
    // If no relevant items and no lease info, cannot calculate score
    return undefined;
  }

  let totalConstraintPoints = 0;

  // 1. Tenure Base Score
  const tenureItem = findItemByKey(items, CHECKLIST_KEYS.TENURE);
  totalConstraintPoints += calculateTenureConstraintPoints(getItemValue(tenureItem));

  // 2. Lease Term Length (uses pre-calculated data)
  const { calculatedLeaseMonths } = calculationData;
  if (calculatedLeaseMonths !== null && calculatedLeaseMonths < 12 * 80) {
    totalConstraintPoints += LEGAL_CONSTRAINT_POINTS.SEVERE; // Short lease is a severe constraint
  }

  // 3. Listed Property Status
  const listedPropertyItem = findItemByKey(items, CHECKLIST_KEYS.LISTED_PROPERTY);
  totalConstraintPoints += calculateLegalPointsForStatus(
    listedPropertyItem,
    LEGAL_CONSTRAINT_POINTS.HIGH
  );

  // 4. Restrictive Covenants
  const restrictiveCovenantsItem = findItemByKey(items, CHECKLIST_KEYS.RESTRICTIVE_COVENANTS);
  totalConstraintPoints += calculateLegalPointsForStatus(
    restrictiveCovenantsItem,
    LEGAL_CONSTRAINT_POINTS.MEDIUM
  );

  // 5. Public Right of Way Obligation
  const publicRightOfWayItem = findItemByKey(items, CHECKLIST_KEYS.PUBLIC_RIGHT_OF_WAY);
  const publicRoWDetails = publicRightOfWayItem?.value as RightOfWayDetails | null;
  const publicRoWStatus = publicRoWDetails?.exists
    ? DataStatus.FOUND_POSITIVE
    : DataStatus.FOUND_NEGATIVE;
  totalConstraintPoints += calculateLegalPointsForStatus(
    publicRightOfWayItem ? { ...publicRightOfWayItem, status: publicRoWStatus } : undefined,
    LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM
  );

  // 6. Private Right of Way Obligation
  const privateRightOfWayItem = findItemByKey(items, CHECKLIST_KEYS.PRIVATE_RIGHT_OF_WAY);
  totalConstraintPoints += calculateLegalPointsForStatus(
    privateRightOfWayItem,
    LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM
  );

  // 7. Planning Permissions (on property)
  const planningPermissionsItem = findItemByKey(items, CHECKLIST_KEYS.PLANNING_PERMISSIONS);
  totalConstraintPoints += calculateLegalPointsForStatus(
    planningPermissionsItem,
    LEGAL_CONSTRAINT_POINTS.LOW
  );

  // 8. Nearby Planning Permissions
  const nearbyPlanningPermissionsItem = findItemByKey(
    items,
    CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS
  );
  totalConstraintPoints += calculateLegalPointsForStatus(
    nearbyPlanningPermissionsItem,
    LEGAL_CONSTRAINT_POINTS.LOW
  );

  // Clamp the score between 0 and 100
  const finalScoreValue = Math.max(0, Math.min(100, totalConstraintPoints));
  const scoreLabel = getLegalConstraintsLabel(finalScoreValue);

  return {
    score: { scoreValue: Math.round(finalScoreValue), maxScore: 100, scoreLabel },
    contributingItems,
  };
};
