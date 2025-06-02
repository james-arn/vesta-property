import FloodRiskDisplay from "@/components/ui/Premium/FloodRiskDisplay";
import { CHECKLIST_NO_VALUE as CNV_TYPE } from "@/constants/checkListConsts";
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { PropertyGroups } from "@/constants/propertyConsts";
import { DataStatus, ExtractedPropertyScrapingData, PreprocessedData, PropertyDataListItem } from "@/types/property";
import React from 'react';
import { getYesNoOrAskAgentStringFromBoolean as GYN_TYPE } from "./helpers"; // Assuming it's in helpers.ts relative to propertyChecklist.tsx

interface FloodRiskHelperDependencies {
  propertyData: ExtractedPropertyScrapingData;
  preprocessedData: PreprocessedData;
  getYesNoOrAskAgentStringFromBoolean: typeof GYN_TYPE;
  CHECKLIST_NO_VALUE: typeof CNV_TYPE;
}

export function generateConsolidatedFloodRiskItem({
  propertyData,
  preprocessedData,
  getYesNoOrAskAgentStringFromBoolean,
  CHECKLIST_NO_VALUE,
}: FloodRiskHelperDependencies): PropertyDataListItem {
  const {
    isPreprocessedDataLoading,
    preprocessedDataError,
    processedPremiumData,
  } = preprocessedData;

  const floodDefencesValue = propertyData.floodDefences;
  const floodSourcesValue = propertyData.floodSources;
  const floodedInLastFiveYearsValue = propertyData.floodedInLastFiveYears;

  const hasActualFloodDefencesData = floodDefencesValue !== null && floodDefencesValue !== undefined;
  const hasActualFloodSourcesData = (floodSourcesValue ?? []).length > 0;
  const hasActualFloodedInLastFiveYearsData = floodedInLastFiveYearsValue !== null && floodedInLastFiveYearsValue !== undefined;

  const hasAnyFreeFloodData = hasActualFloodDefencesData || hasActualFloodSourcesData || hasActualFloodedInLastFiveYearsData;

  const freeFloodDataDisplayElements: React.ReactNode[] = [];
  if (hasActualFloodDefencesData) {
    freeFloodDataDisplayElements.push(
      <div key="defences" className="text-sm">
        <span className="font-semibold">Flood Defences:</span> {getYesNoOrAskAgentStringFromBoolean(floodDefencesValue)}
      </div>
    );
  }
  if (hasActualFloodSourcesData) {
    freeFloodDataDisplayElements.push(
      <div key="sources" className="text-sm">
        <span className="font-semibold">Flood Sources:</span> {propertyData.floodSources?.join(", ") ?? CHECKLIST_NO_VALUE.NOT_MENTIONED}
      </div>
    );
  }
  if (hasActualFloodedInLastFiveYearsData) {
    freeFloodDataDisplayElements.push(
      <div key="last5years" className="text-sm">
        <span className="font-semibold">Flooded in last 5 years:</span> {getYesNoOrAskAgentStringFromBoolean(floodedInLastFiveYearsValue)}
      </div>
    );
  }

  const freeFloodDataComponent = freeFloodDataDisplayElements.length > 0 ? (
    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
      <p className="font-medium text-gray-700 text-xs">Information from property listing:</p>
      {freeFloodDataDisplayElements}
    </div>
  ) : null;

  const determineFloodRiskPresentation = (): {
    status: DataStatus;
    value: React.ReactNode | string;
    askAgentMessage: string;
  } => {
    if (isPreprocessedDataLoading) {
      return {
        status: DataStatus.IS_LOADING,
        value: "Loading detailed flood risk data...",
        askAgentMessage: "",
      };
    }
    if (preprocessedDataError || processedPremiumData?.status === "error") {
      const errorSource = preprocessedDataError ? "preprocessing" : "premium data fetch";
      return {
        status: DataStatus.ASK_AGENT,
        value: (
          <>
            <div className="text-sm text-red-600">Error loading detailed flood risk data ({errorSource}).</div>
            {freeFloodDataComponent}
          </>
        ),
        askAgentMessage: `Could not load detailed flood risk data (${errorSource}). Any information from the listing is shown. Ask Agent?`,
      };
    }
    if (processedPremiumData?.detailedFloodRiskAssessment) {
      return {
        status: DataStatus.FOUND_POSITIVE,
        value: (
          <>
            <FloodRiskDisplay floodRisk={processedPremiumData.detailedFloodRiskAssessment} />
          </>
        ),
        askAgentMessage: "",
      };
    }
    if (hasAnyFreeFloodData) {
      return {
        status: DataStatus.ASK_AGENT,
        value: (
          <>
            {freeFloodDataComponent}
            <div className="mt-2 text-xs text-gray-600 italic">
              A more detailed flood risk assessment (covering rivers, sea, surface/groundwater) may be available with Premium.
            </div>
          </>
        ),
        askAgentMessage: "Basic flood information found. Unlock Premium for a comprehensive detailed assessment.",
      };
    }
    return {
      status: DataStatus.ASK_AGENT,
      value: CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "No flood information found in the listing. Ask Agent and unlock Premium for a detailed assessment.",
    };
  };

  const { status, value, askAgentMessage } = determineFloodRiskPresentation();

  // If premium data for flood risk is already loaded and present, there's no further premium feature to show.
  // Otherwise, if it's not loaded, it implies a premium feature is available (to get the detailed assessment).
  const determinedHasPremiumFeature = !processedPremiumData?.detailedFloodRiskAssessment;

  const consolidatedFloodRiskItem: PropertyDataListItem = {
    checklistGroup: PropertyGroups.RISKS,
    label: "Flood Risk",
    key: CHECKLIST_KEYS.FLOOD_RISK,
    status,
    value,
    askAgentMessage,
    toolTipExplainer:
      "Comprehensive assessment of flood risk, combining information from the property listing (defences, sources, recent flooding if available) with a detailed premium analysis (rivers, sea, surface water, groundwater). " +
      "Premium data provides a more in-depth understanding crucial for insurance and mitigation needs.",
    isExpectedInPremiumSearchData: determinedHasPremiumFeature,
    isExpectedInListing: true,
  };

  return consolidatedFloodRiskItem;
}