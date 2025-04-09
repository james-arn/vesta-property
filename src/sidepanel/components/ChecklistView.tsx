import { ChecklistItem } from "@/components/ui/ChecklistItem";
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { PropertyDataList } from "@/types/property";
import { UseQueryResult } from "@tanstack/react-query";
import React, { lazy, RefObject, Suspense } from "react";

import { CrimeScoreData } from "@/hooks/useCrimeScore";
import { PremiumStreetDataResponse } from "@/types/premiumStreetData";

const LazyCrimePieChart = lazy(() => import('@/components/ui/CrimePieChart'));
const LazyPlanningPermissionCard = lazy(() => import('@/components/ui/Premium/PlanningPermission/PlanningPermissionCard'));


interface ChecklistViewProps {
    filteredChecklistData: PropertyDataList[];
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
}) => {
    // Keep track of the last rendered group within this component instance
    let lastGroup = "";

    return (
        <>
            {filteredChecklistData.map((item, index) => {
                let groupHeader = null;
                if (item.group && item.group !== lastGroup) {
                    groupHeader = (
                        <div
                            key={`group-${item.group}`}
                            className="text-lg font-semibold mt-4 mb-2 p-2 bg-muted rounded cursor-pointer flex justify-between items-center"
                            onClick={() => toggleGroup(item.group as string)}
                        >
                            {item.group}
                            <span>{openGroups[item.group as string] ? '▲' : '▼'}</span>
                        </div>
                    );
                    lastGroup = item.group;
                }

                const isVisible = !item.group || openGroups[item.group];

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
                                    epcData={item.key === 'epc' ? (processedEpcResult ?? undefined) : undefined}
                                    onEpcChange={item.key === 'epc' ? handleEpcValueChange : undefined}
                                    epcDebugCanvasRef={item.key === 'epc' && isEpcDebugModeOn ? epcDebugCanvasRef : undefined}
                                    isEpcDebugModeOn={isEpcDebugModeOn}
                                />

                                {item.key === 'crimeScore' && crimeQuery.data && (
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
                                {item.key === 'planningPermissionData' && premiumStreetDataQuery.data?.data?.attributes?.planning_applications?.length && (
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
                                {item.key === 'nearbyPlanningPermissionData' && premiumStreetDataQuery.data?.data?.attributes?.nearby_planning_applications?.length && (
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