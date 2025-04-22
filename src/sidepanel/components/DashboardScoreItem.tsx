import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { ChecklistItem } from '@/components/ui/ChecklistItem';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { DASHBOARD_CATEGORY_DISPLAY_NAMES, DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import { CrimeScoreData } from '@/hooks/useCrimeScore';
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { PremiumStreetDataResponse } from '@/types/premiumStreetData';
import { CategoryScoreData, PropertyDataListItem } from '@/types/property';
import { UseQueryResult } from '@tanstack/react-query';
import React, { lazy, Suspense } from 'react';
import { FaExclamationTriangle } from "react-icons/fa";
import { ScoreVisualisation } from './ScoreVisualisation';

// Lazy load components needed for expansion
const LazyCrimePieChart = lazy(() => import('@/components/ui/CrimePieChart'));
const LazyPlanningPermissionCard = lazy(() => import('@/components/ui/Premium/PlanningPermission/PlanningPermissionCard'));

type GetValueClickHandlerType = (
    item: PropertyDataListItem,
    openNewTab: (url: string) => void,
    toggleCrimeChart: () => void,
    togglePlanningPermissionCard: () => void,
    toggleNearbyPlanningPermissionCard?: () => void
) => (() => void) | undefined;

interface DashboardScoreItemProps {
    title: string;
    categoryScoreData?: CategoryScoreData;
    invertColorScale?: boolean;
    icon?: React.ElementType;
    isPremiumDataFetched: boolean;
    upgradeUrl: string;
    epcData?: EpcProcessorResult;
    epcDebugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
    isEpcDebugModeOn: boolean;
    getValueClickHandler: GetValueClickHandlerType;
    openNewTab: (url: string) => void;
    toggleCrimeChart: () => void;
    togglePlanningPermissionCard: () => void;
    toggleNearbyPlanningPermissionCard?: () => void;
    handleEpcValueChange: (newValue: string) => void;
    onOpenUpsellModal: () => void;

    // Expansion state, queries, and refs
    crimeQuery: UseQueryResult<CrimeScoreData, Error>;
    premiumStreetDataQuery: UseQueryResult<PremiumStreetDataResponse, Error>;
    crimeChartExpanded: boolean;
    crimeContentRef: React.RefObject<HTMLDivElement | null>;
    crimeContentHeight: number;
    planningPermissionCardExpanded: boolean;
    planningPermissionContentRef: React.RefObject<HTMLDivElement | null>;
    planningPermissionContentHeight: number;
    nearbyPlanningPermissionCardExpanded: boolean;
    nearbyPlanningPermissionContentRef: React.RefObject<HTMLDivElement | null>;
    nearbyPlanningPermissionContentHeight: number;
}

export const DashboardScoreItem: React.FC<DashboardScoreItemProps> = ({
    title,
    categoryScoreData,
    invertColorScale = false,
    icon: IconComponent,
    isPremiumDataFetched,
    epcData,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
    getValueClickHandler,
    openNewTab,
    toggleCrimeChart,
    togglePlanningPermissionCard,
    toggleNearbyPlanningPermissionCard,
    handleEpcValueChange,
    onOpenUpsellModal,
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
    nearbyPlanningPermissionContentHeight
}) => {

    if (!categoryScoreData) {
        return (
            <div className="mb-2 p-3 border rounded-lg bg-gray-50 shadow-sm">
                <div className="flex items-center mb-2">
                    {IconComponent && <IconComponent className="h-5 w-5 mr-2 text-gray-500" />}
                    <h3 className="font-semibold text-gray-600">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground pl-7">Score data unavailable.</p>
            </div>
        );
    }

    const { score, contributingItems, warningMessages } = categoryScoreData;

    const hasContributingItems = contributingItems?.length > 0;

    return (
        <Accordion type="single" collapsible className="w-full border rounded-lg overflow-hidden shadow-sm bg-white mb-1.5 last:mb-0">
            <AccordionItem value={title} className="border-b-0">
                <AccordionTrigger className="px-3 py-2 hover:bg-slate-50 [&[data-state=open]]:bg-slate-50 group">
                    <div className="grid grid-cols-[20px_90px_1fr] items-center w-full gap-x-3 mr-3">
                        {IconComponent && <IconComponent className="h-5 w-5 text-slate-600" />}
                        <h3 className="font-semibold text-slate-800 text-left max-w-[90px]">{title}</h3>
                        <div className="flex flex-col items-start">
                            <ScoreVisualisation score={score} invertColorScale={invertColorScale} showLabel={false} />
                            <div className="flex items-center mt-1">
                                {score.scoreLabel && (
                                    <span className="text-xs font-medium text-slate-600 text-left">
                                        {score.scoreLabel}
                                    </span>
                                )}
                                {warningMessages && warningMessages.length > 0 && (
                                    <TooltipProvider>
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <div className="relative ml-1.5">
                                                    <FaExclamationTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" align="center">
                                                <ul className="list-disc pl-4 space-y-1 max-w-xs text-sm text-left">
                                                    {warningMessages.map((msg, index) => (
                                                        <li key={index}>{msg}</li>
                                                    ))}
                                                </ul>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="bg-slate-50/50 border-t border-slate-100 pt-0 pb-2 px-3">
                    {hasContributingItems ? (
                        <ul className="list-none p-0 m-0 space-y-1">
                            {contributingItems.map((item: PropertyDataListItem) => {
                                const handleClick = getValueClickHandler(
                                    item,
                                    openNewTab,
                                    toggleCrimeChart,
                                    togglePlanningPermissionCard,
                                    toggleNearbyPlanningPermissionCard
                                );
                                return (
                                    <ChecklistItem
                                        key={item.key}
                                        item={item}
                                        isPremiumDataFetched={isPremiumDataFetched}
                                        epcData={item.key === CHECKLIST_KEYS.EPC ? epcData : undefined}
                                        epcDebugCanvasRef={epcDebugCanvasRef}
                                        isEpcDebugModeOn={isEpcDebugModeOn}
                                        onValueClick={handleClick}
                                        onEpcChange={handleEpcValueChange}
                                        onOpenUpsellModal={onOpenUpsellModal}
                                    />
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {title === DASHBOARD_CATEGORY_DISPLAY_NAMES[DashboardScoreCategory.LISTING_COMPLETENESS]
                                ? "All expected listing information appears present."
                                : "No specific contributing factors identified."}
                        </p>
                    )}

                    {/* Conditionally render expandable sections within AccordionContent */}
                    {/* Check if this category contains the crime score item AND if it's expanded */}
                    {contributingItems.some(item => item.key === CHECKLIST_KEYS.CRIME_SCORE) && crimeQuery.data && (
                        <Suspense fallback={<LoadingSpinner />}>
                            <div className="overflow-hidden transition-max-height duration-500 ease-in-out pt-2" style={{ maxHeight: crimeChartExpanded ? `${crimeContentHeight}px` : '0' }}>
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
                    {/* Check if this category contains planning items AND if the property section is expanded */}
                    {contributingItems.some(item => item.key === CHECKLIST_KEYS.PLANNING_PERMISSIONS) && premiumStreetDataQuery.data?.data?.attributes?.planning_applications && (
                        <Suspense fallback={<LoadingSpinner />}>
                            <div className="overflow-hidden transition-max-height duration-500 ease-in-out pt-2" style={{ maxHeight: planningPermissionCardExpanded ? `${planningPermissionContentHeight}px` : '0' }}>
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
                    {/* Check if this category contains planning items AND if the nearby section is expanded */}
                    {contributingItems.some(item => item.key === CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS) && premiumStreetDataQuery.data?.data?.attributes?.nearby_planning_applications && (
                        <Suspense fallback={<LoadingSpinner />}>
                            <div className="overflow-hidden transition-max-height duration-500 ease-in-out pt-2" style={{ maxHeight: nearbyPlanningPermissionCardExpanded ? `${nearbyPlanningPermissionContentHeight}px` : '0' }}>
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

                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}; 