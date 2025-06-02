import { ChecklistItem, ChecklistItemProps } from "@/components/ui/ChecklistItem";
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { EpcBandResult } from "@/types/epc";
import { PropertyDataListItem } from "@/types/property";
import { UseQueryResult } from "@tanstack/react-query";
import React, { lazy, RefObject, Suspense } from "react";

import { useAccordion } from '@/hooks/useAccordion';
import { CrimeScoreData } from "@/hooks/useCrimeScore";
import {
    GetPremiumStreetDataResponse
} from "@/types/premiumStreetData";

const LazyCrimePieChart = lazy(() => import('@/components/ui/CrimePieChart'));
const LazyPlanningPermissionCard = lazy(() => import('@/components/ui/Premium/PlanningPermission/PlanningPermissionCard'));

export interface ChecklistViewProps {
    filteredChecklistData: PropertyDataListItem[];
    openGroups: Record<string, boolean>;
    toggleGroup: (group: string) => void;
    openNewTab: (url: string) => void;
    isPremiumDataFetched: boolean;
    epcBandData?: EpcBandResult | undefined;
    handleEpcValueChange: (newValue: string) => void;
    isEpcDebugModeOn: boolean;
    epcDebugCanvasRef: RefObject<HTMLCanvasElement | null>;
    crimeQuery: UseQueryResult<CrimeScoreData, Error>;
    premiumStreetDataQuery: UseQueryResult<
        GetPremiumStreetDataResponse | null,
        Error
    >;
    crimeChartExpanded: boolean;
    crimeContentRef: RefObject<HTMLDivElement | null>;
    crimeContentHeight: number;
    planningPermissionCardExpanded: boolean;
    planningPermissionContentRef: RefObject<HTMLDivElement | null>;
    planningPermissionContentHeight: number;
    nearbyPlanningPermissionCardExpanded: boolean;
    nearbyPlanningPermissionContentRef: RefObject<HTMLDivElement | null>;
    nearbyPlanningPermissionContentHeight: number;
    onTriggerPremiumFlow: () => void;
    mobileCoverageAccordion: ReturnType<typeof useAccordion>;
    onItemValueClick: (item: PropertyDataListItem) => void;
}

export const ChecklistView: React.FC<ChecklistViewProps> = ({
    filteredChecklistData,
    openGroups,
    toggleGroup,
    openNewTab,
    isPremiumDataFetched,
    epcBandData,
    handleEpcValueChange,
    isEpcDebugModeOn,
    epcDebugCanvasRef,
    crimeQuery,
    premiumStreetDataQuery,
    crimeChartExpanded,
    crimeContentRef,
    crimeContentHeight,
    planningPermissionCardExpanded,
    planningPermissionContentRef,
    planningPermissionContentHeight,
    nearbyPlanningPermissionCardExpanded,
    nearbyPlanningPermissionContentRef,
    nearbyPlanningPermissionContentHeight,
    onTriggerPremiumFlow,
    mobileCoverageAccordion,
    onItemValueClick,
}) => {
    // Keep track of the last rendered group within this component instance
    let lastGroup = "";

    // Safely access nested data
    const planningApplications = premiumStreetDataQuery.data?.premiumData?.data?.attributes?.planning_applications;
    const nearbyPlanningApplications = premiumStreetDataQuery.data?.premiumData?.data?.attributes?.nearby_planning_applications;

    return (
        <>
            {filteredChecklistData.map((item, index) => {
                let groupHeader = null;
                const currentGroup = item.checklistGroup || "Other";

                if (currentGroup !== lastGroup) {
                    groupHeader = (
                        <div
                            className="flex justify-between items-center p-2 bg-gray-200 rounded cursor-pointer my-2 text-sm font-semibold"
                            onClick={() => toggleGroup(currentGroup)}
                        >
                            {currentGroup}
                            <span>{openGroups[currentGroup] ? "▲" : "▼"}</span>
                        </div>
                    );
                    lastGroup = currentGroup;
                }

                const isVisible = openGroups[currentGroup] ?? true;

                const checklistItemProps: ChecklistItemProps = {
                    item,
                    onValueClick: () => onItemValueClick(item),
                    isPremiumDataFetched,
                    epcBandData: epcBandData,
                    onEpcChange: handleEpcValueChange,
                    epcDebugCanvasRef,
                    isEpcDebugModeOn,
                    onOpenUpsellModal: onTriggerPremiumFlow,
                };

                if (item.key === CHECKLIST_KEYS.MOBILE_COVERAGE) {
                    checklistItemProps.mobileCoverageAccordion = mobileCoverageAccordion;
                }

                return (
                    <React.Fragment key={item.key || `item-${index}`}>
                        {groupHeader}
                        {isVisible && (
                            <>
                                <ChecklistItem
                                    {...checklistItemProps}
                                />

                                {item.key === CHECKLIST_KEYS.CRIME_SCORE && crimeQuery.data && (
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <div
                                            className="overflow-hidden transition-max-height duration-500 ease-in-out pl-[calc(1rem+8px)]"
                                            style={{ maxHeight: crimeChartExpanded ? `${crimeContentHeight}px` : '0' }}
                                        >
                                            <div ref={crimeContentRef}>
                                                <LazyCrimePieChart
                                                    crimeSummary={crimeQuery.data.crimeSummary}
                                                    totalCrimes={crimeQuery.data.totalCrimes}
                                                    trendingPercentageOver6Months={crimeQuery.data.trendingPercentageOver6Months}
                                                />
                                            </div>
                                        </div>
                                    </Suspense>
                                )}

                                {item.key === CHECKLIST_KEYS.PLANNING_PERMISSIONS && planningApplications && planningApplications.length > 0 && (
                                    <Suspense fallback={<div className="flex justify-center p-4"><LoadingSpinner /></div>}>
                                        <div
                                            ref={planningPermissionContentRef}
                                            className="pl-[calc(1rem+8px)] pt-2 overflow-hidden transition-max-height duration-500 ease-in-out"
                                            style={{ maxHeight: planningPermissionCardExpanded ? `${planningPermissionContentHeight}px` : '0' }}
                                        >
                                            <LazyPlanningPermissionCard
                                                planningPermissionData={planningApplications}
                                                nearbyPlanningPermissionData={nearbyPlanningApplications}
                                                isLoading={premiumStreetDataQuery.isLoading}
                                                displayMode="property"
                                            />
                                        </div>
                                    </Suspense>
                                )}

                                {item.key === CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS && nearbyPlanningApplications && nearbyPlanningApplications.length > 0 && (
                                    <Suspense fallback={<div className="flex justify-center p-4"><LoadingSpinner /></div>}>
                                        <div
                                            ref={nearbyPlanningPermissionContentRef}
                                            className="pl-[calc(1rem+8px)] pt-2 overflow-hidden transition-max-height duration-500 ease-in-out"
                                            style={{ maxHeight: nearbyPlanningPermissionCardExpanded ? `${nearbyPlanningPermissionContentHeight}px` : '0' }}
                                        >
                                            <LazyPlanningPermissionCard
                                                planningPermissionData={planningApplications}
                                                nearbyPlanningPermissionData={nearbyPlanningApplications}
                                                isLoading={premiumStreetDataQuery.isLoading}
                                                displayMode="nearby"
                                            />
                                        </div>
                                    </Suspense>
                                )}
                            </>
                        )}
                    </React.Fragment>
                );
            })}
            {isEpcDebugModeOn && (
                <canvas ref={epcDebugCanvasRef} style={{ border: '1px solid red', marginTop: '10px', maxWidth: '100%' }}></canvas>
            )}
        </>
    );
}; 