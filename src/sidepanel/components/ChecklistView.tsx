import { ChecklistItem } from "@/components/ui/ChecklistItem";
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { PropertyDataListItem } from "@/types/property";
import { UseQueryResult } from "@tanstack/react-query";
import React, { lazy, RefObject, Suspense } from "react";

import { CrimeScoreData } from "@/hooks/useCrimeScore";
import { PremiumStreetDataResponse } from "@/types/premiumStreetData";

const LazyCrimePieChart = lazy(() => import('@/components/ui/CrimePieChart'));
const LazyPlanningPermissionCard = lazy(() => import('@/components/ui/Premium/PlanningPermission/PlanningPermissionCard'));

export interface ChecklistViewProps {
    filteredChecklistData: PropertyDataListItem[];
    openGroups: Record<string, boolean>;
    toggleGroup: (group: string) => void;
    getValueClickHandler: (...args: any[]) => (() => void) | undefined;
    openNewTab: (url: string) => void;
    toggleCrimeChart: () => void;
    togglePlanningPermissionCard: () => void;
    toggleNearbyPlanningPermissionCard: () => void;
    isPremiumDataFetched: boolean;
    processedEpcResult: EpcProcessorResult | null | undefined;
    handleEpcValueChange: (newValue: string) => void;
    isEpcDebugModeOn: boolean;
    epcDebugCanvasRef: RefObject<HTMLCanvasElement | null>;
    crimeQuery: UseQueryResult<CrimeScoreData, Error>;
    premiumStreetDataQuery: UseQueryResult<PremiumStreetDataResponse, Error>;
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
}

export const ChecklistView: React.FC<ChecklistViewProps> = ({
    filteredChecklistData,
    openGroups,
    toggleGroup,
    getValueClickHandler,
    openNewTab,
    toggleCrimeChart,
    togglePlanningPermissionCard,
    toggleNearbyPlanningPermissionCard,
    isPremiumDataFetched,
    processedEpcResult,
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
}) => {
    // Keep track of the last rendered group within this component instance
    let lastGroup = "";

    return (
        <>
            {filteredChecklistData.map((item, index) => {
                let groupHeader = null;
                if (item.checklistGroup && item.checklistGroup !== lastGroup) {
                    groupHeader = (
                        <div
                            key={`group-${item.checklistGroup}`}
                            className="text-lg font-semibold mt-4 mb-2 p-2 bg-muted rounded cursor-pointer flex justify-between items-center"
                            onClick={() => toggleGroup(item.checklistGroup as string)}
                        >
                            {item.checklistGroup}
                            <span>{openGroups[item.checklistGroup as string] ? '▲' : '▼'}</span>
                        </div>
                    );
                    lastGroup = item.checklistGroup;
                }

                const isVisible = !item.checklistGroup || openGroups[item.checklistGroup];

                return (
                    <React.Fragment key={item.key || `item-${index}`}>
                        {groupHeader}
                        {isVisible && (
                            <>
                                <ChecklistItem
                                    item={item}
                                    onValueClick={getValueClickHandler(
                                        item,
                                        openNewTab,
                                        toggleCrimeChart,
                                        togglePlanningPermissionCard,
                                        toggleNearbyPlanningPermissionCard
                                    )}
                                    isPremiumDataFetched={isPremiumDataFetched}
                                    epcData={item.key === CHECKLIST_KEYS.EPC ? (processedEpcResult ?? undefined) : undefined}
                                    onEpcChange={item.key === CHECKLIST_KEYS.EPC ? handleEpcValueChange : undefined}
                                    epcDebugCanvasRef={item.key === CHECKLIST_KEYS.EPC && isEpcDebugModeOn ? epcDebugCanvasRef : undefined}
                                    isEpcDebugModeOn={isEpcDebugModeOn}
                                    onOpenUpsellModal={onTriggerPremiumFlow}
                                />

                                {item.key === CHECKLIST_KEYS.CRIME_SCORE && crimeQuery.data && (
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <div className="overflow-hidden transition-max-height duration-500 ease-in-out pl-[calc(1rem+8px)]" style={{ maxHeight: crimeChartExpanded ? `${crimeContentHeight}px` : '0' }}>
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
                                {item.key === CHECKLIST_KEYS.PLANNING_PERMISSIONS && premiumStreetDataQuery.data?.data?.attributes?.planning_applications?.length && (
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <div className="overflow-hidden transition-max-height duration-500 ease-in-out pl-[calc(1rem+8px)]" style={{ maxHeight: planningPermissionCardExpanded ? `${planningPermissionContentHeight}px` : '0' }}>
                                            <div ref={planningPermissionContentRef}>
                                                <LazyPlanningPermissionCard
                                                    planningPermissionData={premiumStreetDataQuery.data.data.attributes.planning_applications}
                                                    nearbyPlanningPermissionData={premiumStreetDataQuery.data.data.attributes.nearby_planning_applications}
                                                    isLoading={premiumStreetDataQuery.isLoading}
                                                    displayMode="property"
                                                />
                                            </div>
                                        </div>
                                    </Suspense>
                                )}
                                {item.key === CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS && premiumStreetDataQuery.data?.data?.attributes?.nearby_planning_applications?.length && (
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <div className="overflow-hidden transition-max-height duration-500 ease-in-out pl-[calc(1rem+8px)]" style={{ maxHeight: nearbyPlanningPermissionCardExpanded ? `${nearbyPlanningPermissionContentHeight}px` : '0' }}>
                                            <div ref={nearbyPlanningPermissionContentRef}>
                                                <LazyPlanningPermissionCard
                                                    planningPermissionData={premiumStreetDataQuery.data.data.attributes.planning_applications}
                                                    nearbyPlanningPermissionData={premiumStreetDataQuery.data.data.attributes.nearby_planning_applications}
                                                    isLoading={premiumStreetDataQuery.isLoading}
                                                    displayMode="nearby"
                                                />
                                            </div>
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