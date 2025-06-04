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
  ProcessedConservationAreaData,
  PropertyDataListItem,
} from "@/types/property";
import { findItemByKey, getItemValue } from "@/utils/parsingHelpers";
import {
  calculateTenureConstraintPoints,
  determinePenaltyPointsFromValue,
  getLegalConstraintsLabel,
  isDataMissing,
} from "./helpers/legalContraintsProcessingHelpers";

interface CalculationData {
  calculatedLeaseMonths: number | null;
  tenure: string | null;
  processedConservationArea: ProcessedConservationAreaData | null;
}

interface FactorConfig {
  key: ChecklistKey;
  warningMessage: string;
  isRelevantToProperty?: (isLeasehold: boolean, calculationData: CalculationData) => boolean;
  calculatePoints?: (
    item: PropertyDataListItem | undefined,
    calculationData: CalculationData
  ) => number;
}

interface ProcessedFactorDetail {
  key: ChecklistKey;
  penaltyPoints: number;
  isRelevant: boolean;
  hasData: boolean;
  warning?: string;
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
      warningMessage: "Tenure information missing.",
      calculatePoints: (item) => calculateTenureConstraintPoints(getItemValue(item)),
    },
    {
      key: CHECKLIST_KEYS.LEASE_TERM,
      warningMessage: "Lease term information missing.",
      isRelevantToProperty: (isLeasehold) => isLeasehold,
      calculatePoints: (_, calcData) =>
        calcData.calculatedLeaseMonths !== null && calcData.calculatedLeaseMonths < 12 * 80
          ? LEGAL_CONSTRAINT_POINTS.SEVERE
          : 0,
    },
    {
      key: CHECKLIST_KEYS.LISTED_PROPERTY,
      warningMessage: "Listed property status missing.",
      calculatePoints: (item) => (item ? determinePenaltyPointsFromValue(item) : 0),
    },
    {
      key: CHECKLIST_KEYS.RESTRICTIVE_COVENANTS,
      warningMessage: "Restrictive covenants status missing.",
      calculatePoints: (item) => (item ? determinePenaltyPointsFromValue(item) : 0),
    },
    {
      key: CHECKLIST_KEYS.PUBLIC_RIGHT_OF_WAY,
      warningMessage: "Public Right of Way status missing.",
      calculatePoints: (item) => (item ? determinePenaltyPointsFromValue(item) : 0),
    },
    {
      key: CHECKLIST_KEYS.PRIVATE_RIGHT_OF_WAY,
      warningMessage: "Private Right of Way status missing.",
      calculatePoints: (item) => (item ? determinePenaltyPointsFromValue(item) : 0),
    },
    {
      key: CHECKLIST_KEYS.PLANNING_PERMISSIONS,
      warningMessage: "Property planning permission status missing.",
      calculatePoints: (item) => (item ? determinePenaltyPointsFromValue(item) : 0),
    },
    {
      key: CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS,
      warningMessage: "Nearby planning permission status missing.",
      calculatePoints: (item) => (item ? determinePenaltyPointsFromValue(item) : 0),
    },
    {
      key: CHECKLIST_KEYS.CONSERVATION_AREA_STATUS,
      warningMessage: "Conservation area status missing or unknown.",
      isRelevantToProperty: () => true,
      calculatePoints: (_, calcData) =>
        calcData.processedConservationArea?.isInArea ? LEGAL_CONSTRAINT_POINTS.MEDIUM : 0,
    },
  ];

  const processedFactorDetails = factors.reduce<ProcessedFactorDetail[]>((acc, factor) => {
    const item = findItemByKey(items, factor.key);
    const isRelevant = factor.isRelevantToProperty
      ? factor.isRelevantToProperty(isLeasehold, calculationData)
      : true;

    if (!isRelevant) {
      // Not relevant, 0 points, no warning needed
      return [
        ...acc,
        {
          key: factor.key,
          penaltyPoints: 0,
          isRelevant: false,
          hasData: false, // Data presence is irrelevant if factor isn't relevant
          warning: undefined,
        },
      ];
    }

    const dataIsMissing = isDataMissing(item);

    // Specific check for lease term - consider scorable if term item OR calculated months exist
    let factorHasData = !dataIsMissing;
    if (factor.key === CHECKLIST_KEYS.LEASE_TERM && isLeasehold) {
      factorHasData = factorHasData || calculatedLeaseMonths !== null;
    }
    // Specific data check for conservation area
    if (factor.key === CHECKLIST_KEYS.CONSERVATION_AREA_STATUS) {
      factorHasData =
        !!calculationData.processedConservationArea &&
        calculationData.processedConservationArea.status !== DataStatus.ASK_AGENT &&
        calculationData.processedConservationArea.status !== DataStatus.IS_LOADING;
    }

    if (factorHasData) {
      // Relevant and has data: calculate points
      const calculatedPenaltyPoints = factor.calculatePoints
        ? factor.calculatePoints(item, calculationData)
        : 0;
      return [
        ...acc,
        {
          key: factor.key,
          penaltyPoints: calculatedPenaltyPoints,
          isRelevant: true,
          hasData: true,
          warning: undefined,
        },
      ];
    } else {
      // Relevant but data is missing: 0 points, add warning
      return [
        ...acc,
        {
          key: factor.key,
          penaltyPoints: 0,
          isRelevant: true,
          hasData: false,
          warning: factor.warningMessage,
        },
      ];
    }
  }, []);

  // --- Extract information from processed details ---
  const warnings = processedFactorDetails
    .map((detail) => detail.warning)
    .filter((warning): warning is string => !!warning); // Filter out undefined

  const scorableCount = processedFactorDetails.filter(
    (detail) => detail.isRelevant && detail.hasData
  ).length;

  // --- Check Scorable Count ---
  if (scorableCount < MIN_SCORABLE_ITEMS) {
    const finalWarnings = [
      ...warnings,
      `Only ${scorableCount} factor(s) had usable data, need at least ${MIN_SCORABLE_ITEMS} to calculate score.`,
    ];
    return {
      score: null,
      contributingItems: contributingItems,
      warningMessages: finalWarnings.filter((v, i, a) => a.indexOf(v) === i), // Deduplicate warnings
      calculationStatus: CALCULATED_STATUS.UNCALCULATED_MISSING_DATA,
    };
  }

  // --- Aggregate Score --- //
  const totalConstraintPenaltyPoints = processedFactorDetails.reduce(
    (sum, detail) => sum + detail.penaltyPoints,
    0
  );

  const scoreValue = Math.max(0, 100 - totalConstraintPenaltyPoints);
  const finalScoreValue = Math.round(scoreValue);
  const scoreLabel = getLegalConstraintsLabel(finalScoreValue);

  const finalScore: DashboardScore = {
    scoreValue: finalScoreValue,
    maxScore: 100,
    scoreLabel: scoreLabel,
  };

  return {
    score: finalScore,
    contributingItems,
    warningMessages: warnings.filter((v, i, a) => a.indexOf(v) === i), // Deduplicate original warnings
    calculationStatus: CALCULATED_STATUS.CALCULATED,
  };
};
