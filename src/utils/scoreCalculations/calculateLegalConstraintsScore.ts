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
  tenure: string | null; // Pass tenure for leasehold check
}

const isDataMissing = (status: DataStatus | undefined): boolean => {
  return (
    status === undefined || status === DataStatus.ASK_AGENT || status === DataStatus.IS_LOADING
  );
};

// --- Main Calculation Function ---
export const calculateLegalConstraintsScore = (
  items: PropertyDataListItem[],
  calculationData: CalculationData
): CategoryScoreData | undefined => {
  const contributingFactorKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.LEGAL_CONSTRAINTS] || [];
  const contributingItems = items.filter((item) => contributingFactorKeys.includes(item.key));
  const warningMessages: string[] = [];

  const hasLeaseData = calculationData.calculatedLeaseMonths !== null;
  const isLeasehold = calculationData.tenure?.toLowerCase() === "leasehold";

  // Check if we can even calculate a score
  if (contributingItems.length === 0 && (!isLeasehold || !hasLeaseData)) {
    // If no relevant items and no applicable lease info, cannot calculate score
    return undefined;
  }

  // --- Calculate points & add warnings for each constraint factor ---

  // 1. Tenure
  const tenureItem = findItemByKey(items, CHECKLIST_KEYS.TENURE);
  const tenurePoints = calculateTenureConstraintPoints(getItemValue(tenureItem));
  if (isDataMissing(tenureItem?.status)) {
    warningMessages.push("Tenure information missing, score may be less reliable.");
  }

  // 2. Lease Term
  const { calculatedLeaseMonths } = calculationData;
  let leaseTermPoints = 0;
  if (isLeasehold) {
    leaseTermPoints =
      calculatedLeaseMonths !== null && calculatedLeaseMonths < 12 * 80
        ? LEGAL_CONSTRAINT_POINTS.SEVERE
        : 0;
    // Check lease term warning only if property is leasehold
    const leaseTermItem = findItemByKey(items, CHECKLIST_KEYS.LEASE_TERM);
    if (isDataMissing(leaseTermItem?.status) && calculatedLeaseMonths === null) {
      warningMessages.push("Lease term information missing.");
    }
  }

  // 3. Listed Property
  const listedPropertyItem = findItemByKey(items, CHECKLIST_KEYS.LISTED_PROPERTY);
  const listedPropertyPoints = calculateLegalPointsForStatus(
    listedPropertyItem,
    LEGAL_CONSTRAINT_POINTS.HIGH
  );
  if (isDataMissing(listedPropertyItem?.status)) {
    warningMessages.push("Listed property status missing.");
  }

  // 4. Restrictive Covenants
  const restrictiveCovenantsItem = findItemByKey(items, CHECKLIST_KEYS.RESTRICTIVE_COVENANTS);
  const restrictiveCovenantPoints = calculateLegalPointsForStatus(
    restrictiveCovenantsItem,
    LEGAL_CONSTRAINT_POINTS.MEDIUM
  );
  if (isDataMissing(restrictiveCovenantsItem?.status)) {
    warningMessages.push("Restrictive covenants status missing, score may be less reliable.");
  }

  // 5. Public Right of Way
  const publicRightOfWayItem = findItemByKey(items, CHECKLIST_KEYS.PUBLIC_RIGHT_OF_WAY);
  const publicRoWDetails = publicRightOfWayItem?.value as RightOfWayDetails | null;
  const publicRoWStatus = publicRoWDetails?.exists
    ? DataStatus.FOUND_POSITIVE
    : DataStatus.FOUND_NEGATIVE;
  const publicRightOfWayPoints = calculateLegalPointsForStatus(
    // Use the derived status for calculation
    publicRightOfWayItem ? { ...publicRightOfWayItem, status: publicRoWStatus } : undefined,
    LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM
  );
  const publicRightOfWayItemStatus = publicRightOfWayItem?.status;
  if (publicRightOfWayItemStatus === DataStatus.ASK_AGENT) {
    warningMessages.push("Public Right of Way status missing, score may be less reliable.");
  }

  // 6. Private Right of Way
  const privateRightOfWayItem = findItemByKey(items, CHECKLIST_KEYS.PRIVATE_RIGHT_OF_WAY);
  const privateRightOfWayPoints = calculateLegalPointsForStatus(
    privateRightOfWayItem,
    LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM
  );
  if (isDataMissing(privateRightOfWayItem?.status)) {
    warningMessages.push("Private Right of Way status missing.");
  }

  // 7. Planning Permissions (on property)
  const planningPermissionsItem = findItemByKey(items, CHECKLIST_KEYS.PLANNING_PERMISSIONS);
  const planningPermissionsPoints = calculateLegalPointsForStatus(
    planningPermissionsItem,
    LEGAL_CONSTRAINT_POINTS.LOW
  );
  if (isDataMissing(planningPermissionsItem?.status)) {
    warningMessages.push("Property planning permission status missing.");
  }

  // 8. Nearby Planning Permissions
  const nearbyPlanningPermissionsItem = findItemByKey(
    items,
    CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS
  );
  const nearbyPlanningPoints = calculateLegalPointsForStatus(
    nearbyPlanningPermissionsItem,
    LEGAL_CONSTRAINT_POINTS.LOW
  );
  if (isDataMissing(nearbyPlanningPermissionsItem?.status)) {
    warningMessages.push("Nearby planning permission status missing, score may be less reliable.");
  }

  // --- Aggregate Score --- //

  // Array of constraint points
  const constraintPointsArray = [
    tenurePoints,
    leaseTermPoints,
    listedPropertyPoints,
    restrictiveCovenantPoints,
    publicRightOfWayPoints,
    privateRightOfWayPoints,
    planningPermissionsPoints,
    nearbyPlanningPoints,
  ];

  // Sum points using reduce
  const totalConstraintPoints = constraintPointsArray.reduce((sum, points) => sum + points, 0);

  // Clamp the score between 0 and 100
  const finalScoreValue = Math.max(0, Math.min(100, totalConstraintPoints));
  const scoreLabel = getLegalConstraintsLabel(finalScoreValue);

  return {
    score: { scoreValue: Math.round(finalScoreValue), maxScore: 100, scoreLabel },
    contributingItems,
    warningMessages,
  };
};
