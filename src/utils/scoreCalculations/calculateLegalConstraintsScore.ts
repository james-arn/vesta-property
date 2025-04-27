import { CHECKLIST_KEYS, ChecklistKey } from "@/constants/checklistKeys";
import {
  CALCULATED_STATUS,
  CATEGORY_ITEM_MAP,
  DashboardScoreCategory,
} from "@/constants/dashboardScoreCategoryConsts";
import { LEGAL_CONSTRAINT_POINTS } from "@/constants/scoreConstants";
import {
  CategoryScoreData,
  DashboardScore,
  DataStatus,
  PropertyDataListItem,
  RightOfWayDetails,
} from "@/types/property";
import { findItemByKey, getItemValue } from "@/utils/parsingHelpers";
import {
  calculateLegalPointsForStatus,
  calculateTenureConstraintPoints,
  getLegalConstraintsLabel,
  isDataMissing,
} from "./helpers/legalContraintsProcessingHelpers";

interface CalculationData {
  calculatedLeaseMonths: number | null;
  tenure: string | null;
}

interface FactorConfig {
  key: ChecklistKey;
  pointsIfPositive: number;
  warningMessage: string;
  isApplicable?: (isLeasehold: boolean, calculationData: CalculationData) => boolean;
  calculatePoints?: (
    item: PropertyDataListItem | undefined,
    calculationData: CalculationData
  ) => number;
}

// --- Main Calculation Function ---
export const calculateLegalConstraintsScore = (
  items: PropertyDataListItem[],
  calculationData: CalculationData
): CategoryScoreData => {
  const contributingFactorKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.LEGAL_CONSTRAINTS] || [];
  const contributingItems = items.filter((item) => contributingFactorKeys.includes(item.key));
  const MIN_SCORABLE_ITEMS = 2; // Need at least 2 factors with data to calculate

  const { calculatedLeaseMonths, tenure } = calculationData;
  const isLeasehold = tenure?.toLowerCase() === "leasehold";

  // Define all factors to process
  const factors: FactorConfig[] = [
    {
      key: CHECKLIST_KEYS.TENURE,
      pointsIfPositive: 0, // Points calculated differently
      warningMessage: "Tenure information missing.",
      calculatePoints: (item) => calculateTenureConstraintPoints(getItemValue(item)),
    },
    {
      key: CHECKLIST_KEYS.LEASE_TERM,
      pointsIfPositive: LEGAL_CONSTRAINT_POINTS.SEVERE,
      warningMessage: "Lease term information missing.",
      isApplicable: (isLeasehold) => isLeasehold,
      calculatePoints: (_, calcData) =>
        calcData.calculatedLeaseMonths !== null && calcData.calculatedLeaseMonths < 12 * 80
          ? LEGAL_CONSTRAINT_POINTS.SEVERE
          : 0,
    },
    {
      key: CHECKLIST_KEYS.LISTED_PROPERTY,
      pointsIfPositive: LEGAL_CONSTRAINT_POINTS.HIGH,
      warningMessage: "Listed property status missing.",
      calculatePoints: (item) => calculateLegalPointsForStatus(item, LEGAL_CONSTRAINT_POINTS.HIGH),
    },
    {
      key: CHECKLIST_KEYS.RESTRICTIVE_COVENANTS,
      pointsIfPositive: LEGAL_CONSTRAINT_POINTS.MEDIUM,
      warningMessage: "Restrictive covenants status missing.",
      calculatePoints: (item) =>
        calculateLegalPointsForStatus(item, LEGAL_CONSTRAINT_POINTS.MEDIUM),
    },
    {
      key: CHECKLIST_KEYS.PUBLIC_RIGHT_OF_WAY,
      pointsIfPositive: LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM,
      warningMessage: "Public Right of Way status missing.",
      calculatePoints: (item) => {
        const details = item?.value as RightOfWayDetails | null;
        const status = details?.exists ? DataStatus.FOUND_POSITIVE : DataStatus.FOUND_NEGATIVE;
        return calculateLegalPointsForStatus(
          item ? { ...item, status } : undefined,
          LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM
        );
      },
    },
    {
      key: CHECKLIST_KEYS.PRIVATE_RIGHT_OF_WAY,
      pointsIfPositive: LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM,
      warningMessage: "Private Right of Way status missing.",
      calculatePoints: (item) =>
        calculateLegalPointsForStatus(item, LEGAL_CONSTRAINT_POINTS.LOW_MEDIUM),
    },
    {
      key: CHECKLIST_KEYS.PLANNING_PERMISSIONS,
      pointsIfPositive: LEGAL_CONSTRAINT_POINTS.LOW,
      warningMessage: "Property planning permission status missing.",
      calculatePoints: (item) => calculateLegalPointsForStatus(item, LEGAL_CONSTRAINT_POINTS.LOW),
    },
    {
      key: CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS,
      pointsIfPositive: LEGAL_CONSTRAINT_POINTS.LOW,
      warningMessage: "Nearby planning permission status missing.",
      calculatePoints: (item) => calculateLegalPointsForStatus(item, LEGAL_CONSTRAINT_POINTS.LOW),
    },
  ];

  // Process factors using reduce
  const initialState = { points: [] as number[], warnings: [] as string[], scorableCount: 0 };
  const processedFactors = factors.reduce((acc, factor) => {
    const item = findItemByKey(items, factor.key);
    const applicable = factor.isApplicable
      ? factor.isApplicable(isLeasehold, calculationData)
      : true;

    if (!applicable) {
      return { ...acc, points: [...acc.points, 0] }; // Not applicable, 0 points
    }

    // Use updated isDataMissing check
    const dataIsMissing = isDataMissing(item);

    // Specific check for lease term - consider scorable if term item OR calculated months exist
    let factorHasData = !dataIsMissing;
    if (factor.key === CHECKLIST_KEYS.LEASE_TERM && isLeasehold) {
      // We consider lease term data present if the item isn't missing OR if we have the calculated months
      factorHasData = factorHasData || calculatedLeaseMonths !== null;
    }

    if (factorHasData) {
      const calculatedPoints = factor.calculatePoints
        ? factor.calculatePoints(item, calculationData)
        : // Check item status within calculatePoints if ASK_AGENT needs specific handling
          0;
      return {
        points: [...acc.points, calculatedPoints],
        warnings: acc.warnings,
        scorableCount: acc.scorableCount + 1,
      };
    } else {
      // Data is missing for this applicable factor
      return {
        points: [...acc.points, 0], // Add 0 points
        warnings: [...acc.warnings, factor.warningMessage],
        scorableCount: acc.scorableCount,
      };
    }
  }, initialState);

  // --- Check Scorable Count ---
  if (processedFactors.scorableCount < MIN_SCORABLE_ITEMS) {
    // Add a more specific warning if calculation is stopped
    const finalWarnings = [
      ...processedFactors.warnings,
      `Only ${processedFactors.scorableCount} factor(s) had usable data, need at least ${MIN_SCORABLE_ITEMS} to calculate score.`,
    ];
    return {
      score: null,
      contributingItems: contributingItems,
      warningMessages: finalWarnings.filter((v, i, a) => a.indexOf(v) === i), // Deduplicate warnings
      calculationStatus: CALCULATED_STATUS.UNCALCULATED_MISSING_DATA,
    };
  }

  // --- Aggregate Score --- //
  const totalConstraintPoints = processedFactors.points.reduce((sum, points) => sum + points, 0);

  const MAX_POSSIBLE_PENALTY_POINTS = 30; // Example: needs calibration
  const scoreValue = Math.max(0, 100 - (totalConstraintPoints / MAX_POSSIBLE_PENALTY_POINTS) * 100);
  const finalScoreValue = Math.max(0, Math.min(100, Math.round(scoreValue)));

  const scoreLabel = getLegalConstraintsLabel(finalScoreValue);

  const finalScore: DashboardScore = {
    scoreValue: finalScoreValue,
    maxScore: 100,
    scoreLabel: scoreLabel,
  };

  return {
    score: finalScore,
    contributingItems,
    warningMessages: processedFactors.warnings.filter((v, i, a) => a.indexOf(v) === i),
    calculationStatus: CALCULATED_STATUS.CALCULATED,
  };
};
