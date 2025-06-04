import { CHECKLIST_NO_VALUE as CNV_TYPE } from "@/constants/checkListConsts";
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { FLOOD_RISK_LABELS } from "@/constants/floodRiskConstants";
import { PropertyGroups } from "@/constants/propertyConsts";
import {
  CompleteFloodRiskAssessment,
  DataStatus,
  PreprocessedData,
  PropertyDataListItem
} from "@/types/property";
import { logErrorToSentry } from "@/utils/sentry";

interface FloodRiskHelperDependencies {
  preprocessedData: PreprocessedData;
  CHECKLIST_NO_VALUE: typeof CNV_TYPE;
  completeFloodRiskAssessment: CompleteFloodRiskAssessment | null;
  isPremiumDataFetchedAndHasData: boolean;
}

const getPresentationDetails = (
  completeFloodRiskAssessment: CompleteFloodRiskAssessment,
  CHECKLIST_NO_VALUE: typeof CNV_TYPE,
  isPremiumDataFetchedAndHasData: boolean
): { value: string; status: DataStatus; askMessage: string } => {
  const { listingFloodRiskAssessment, premiumFloodRiskAssessment } = completeFloodRiskAssessment;

  const listingScore = listingFloodRiskAssessment?.score;
  const premiumScore = premiumFloodRiskAssessment?.score;
  const premiumRiskLabel = premiumScore?.riskLabel;

  const status = (() => {
    if (premiumRiskLabel === FLOOD_RISK_LABELS.HIGH_RISK || premiumRiskLabel === FLOOD_RISK_LABELS.MEDIUM_RISK) {
      return DataStatus.ASK_AGENT;
    }
    if (
      premiumRiskLabel === FLOOD_RISK_LABELS.LOW_RISK ||
      premiumRiskLabel === FLOOD_RISK_LABELS.VERY_LOW_RISK ||
      premiumRiskLabel === FLOOD_RISK_LABELS.ASSESSMENT_AVAILABLE_NO_SPECIFIC_LEVELS ||
      premiumRiskLabel === FLOOD_RISK_LABELS.ASSESSMENT_AVAILABLE_UNQUANTIFIED ||
      premiumRiskLabel === FLOOD_RISK_LABELS.RISK_LEVEL_ASSESSED ||
      premiumRiskLabel === FLOOD_RISK_LABELS.PREMIUM_ASSESSMENT_AVAILABLE
    ) {
      return DataStatus.FOUND_POSITIVE;
    }
    if (listingScore && listingScore.scoreContribution > 0 && listingScore.maxPossibleScore > 0) {
      return DataStatus.ASK_AGENT;
    }
    if (listingScore && listingScore.maxPossibleScore > 0) {
      return DataStatus.FOUND_POSITIVE;
    }
    if (premiumFloodRiskAssessment?.floodRisk && !premiumRiskLabel) {
      return DataStatus.FOUND_POSITIVE;
    }
    return DataStatus.ASK_AGENT;
  })();

  const listingValuePart = listingScore && listingScore.maxPossibleScore > 0
    ? `Based on listing only: ${listingScore.riskLabel}`
    : listingFloodRiskAssessment?.floodDefences !== null || listingFloodRiskAssessment?.floodedInLastFiveYears !== null || (listingFloodRiskAssessment?.floodSources && listingFloodRiskAssessment.floodSources.length > 0)
      ? FLOOD_RISK_LABELS.BASIC_INFO_AVAILABLE
      : null;

  const premiumValuePart = premiumRiskLabel
    ? `${premiumRiskLabel}`
    : premiumFloodRiskAssessment?.floodRisk
      ? FLOOD_RISK_LABELS.PREMIUM_ASSESSMENT_AVAILABLE
      : null;


  const value = premiumValuePart && isPremiumDataFetchedAndHasData
    ? premiumValuePart
    : listingValuePart || CHECKLIST_NO_VALUE.NOT_AVAILABLE;

  const askMessage = (() => {
    if (
      completeFloodRiskAssessment.listingFloodRiskAssessment?.floodedInLastFiveYears
      || completeFloodRiskAssessment.premiumFloodRiskAssessment?.score?.riskLabel === FLOOD_RISK_LABELS.HIGH_RISK
      || completeFloodRiskAssessment.premiumFloodRiskAssessment?.score?.riskLabel === FLOOD_RISK_LABELS.MEDIUM_RISK
    ) {
      return "I noticed that this property may have flooding issues. Please could you give me more information on this?";
    }
    return "" // no message needed
  })();

  return { value, status, askMessage };
};

export function generateConsolidatedFloodRiskItem({
  preprocessedData,
  CHECKLIST_NO_VALUE,
  completeFloodRiskAssessment,
  isPremiumDataFetchedAndHasData
}: FloodRiskHelperDependencies): PropertyDataListItem {
  const { isPreprocessedDataLoading, preprocessedDataError } = preprocessedData;

  const premiumFloodRiskAssessmentForFeatureCheck = completeFloodRiskAssessment?.premiumFloodRiskAssessment;

  if (isPreprocessedDataLoading) {
    return {
      checklistGroup: PropertyGroups.RISKS,
      label: "Flood Risk",
      key: CHECKLIST_KEYS.FLOOD_RISK,
      status: DataStatus.IS_LOADING,
      value: "Loading detailed flood risk data...",
      askAgentMessage: "",
      toolTipExplainer: "Loading...",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
      completeFloodRiskAssessment: null,
    };
  }

  if (preprocessedDataError || !completeFloodRiskAssessment) {
    const errorToLog = preprocessedDataError || new Error("Missing completeFloodRiskAssessment in generateConsolidatedFloodRiskItem");
    logErrorToSentry(errorToLog.message, "error");
    return {
      checklistGroup: PropertyGroups.RISKS,
      label: "Flood Risk",
      key: CHECKLIST_KEYS.FLOOD_RISK,
      status: DataStatus.ASK_AGENT,
      value: CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer: "Could not retrieve or process flood risk information.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
      completeFloodRiskAssessment: null,
    };
  }

  const { value, status, askMessage } = getPresentationDetails(completeFloodRiskAssessment, CHECKLIST_NO_VALUE, isPremiumDataFetchedAndHasData);

  const determinedHasPremiumFeature =
    !premiumFloodRiskAssessmentForFeatureCheck?.floodRisk ||
    (premiumFloodRiskAssessmentForFeatureCheck?.score?.maxPossibleScore === 0 &&
      premiumFloodRiskAssessmentForFeatureCheck?.score?.scoreContribution === 0 &&
      !premiumFloodRiskAssessmentForFeatureCheck?.score?.riskLabel);

  return {
    checklistGroup: PropertyGroups.RISKS,
    label: "Flood Risk",
    key: CHECKLIST_KEYS.FLOOD_RISK,
    status,
    value,
    askAgentMessage: askMessage,
    toolTipExplainer:
      "Comprehensive assessment of flood risk, combining information from the property listing (defences, sources, recent flooding if available) with a detailed premium analysis (rivers, sea, surface water, groundwater). " +
      "Premium data provides a more in-depth understanding crucial for insurance and mitigation needs.",
    isExpectedInPremiumSearchData: determinedHasPremiumFeature,
    isExpectedInListing: true,
    hasMoreDetailsInPremiumThanListingValue: !!completeFloodRiskAssessment?.premiumFloodRiskAssessment?.floodRisk,
    completeFloodRiskAssessment,
  };
}