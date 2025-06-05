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
import { CALCULATED_STATUS, DashboardScoreCategory, DISABLED_BAR_BACKGROUND } from "@/constants/dashboardScoreCategoryConsts";
import { useAccordion } from "@/hooks/useAccordion";
import { CrimeScoreData } from '@/hooks/useCrimeScore';
import { EpcBandResult } from "@/types/epc";
import {
    GetPremiumStreetDataResponse
} from '@/types/premiumStreetData';
import { CategoryScoreData, PropertyDataListItem } from '@/types/property';
import { UseQueryResult } from '@tanstack/react-query';
import React, { lazy, Suspense } from 'react';
import { FaExclamationTriangle } from "react-icons/fa";
import { ScoreVisualisation } from './ScoreVisualisation';

const LazyCrimePieChart = lazy(() => import('@/components/ui/CrimePieChart'));
const LazyPlanningPermissionCard = lazy(() => import('@/components/ui/Premium/PlanningPermission/PlanningPermissionCard'));
const LazyMobileCoverageDisplay = lazy(() =>
    import('@/components/MobileCoverageDisplay').then(module => ({ default: module.MobileCoverageDisplay }))
);
const LazyCoastalErosionDisplay = lazy(() =>
    import('@/components/CoastalErosionDisplay').then(module => ({ default: module.default }))
);
const LazyFloodRiskDisplay = lazy(() =>
    import('@/components/ui/Premium/FloodRiskDisplay').then(module => ({ default: module.default }))
);

interface DashboardScoreItemProps {
    title: string;
    category: DashboardScoreCategory;
    categoryScoreData?: CategoryScoreData;
    isExpanded: boolean;
    onToggleExpand: (category: DashboardScoreCategory) => void;
    invertColorScale?: boolean;
    icon?: React.ElementType;
    isPremiumDataFetchedAndHasData: boolean;
    upgradeUrl: string;
    epcBandData?: EpcBandResult | undefined;
    epcDebugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
    isEpcDebugModeOn: boolean;
    onItemValueClick: (item: PropertyDataListItem) => void;
    handleEpcValueChange: (newValue: string) => void;
    onOpenUpsellModal: () => void;
    crimeQuery: UseQueryResult<CrimeScoreData, Error>;
    premiumStreetDataQuery: UseQueryResult<
        GetPremiumStreetDataResponse | null,
        Error
    >;
    mobileCoverageAccordion?: ReturnType<typeof useAccordion>;
    coastalErosionAccordion?: ReturnType<typeof useAccordion>;
    floodRiskAccordion?: ReturnType<typeof useAccordion>;
    crimeAccordion?: ReturnType<typeof useAccordion>;
    planningPermissionAccordion?: ReturnType<typeof useAccordion>;
    nearbyPlanningPermissionAccordion?: ReturnType<typeof useAccordion>;
}

export const DashboardScoreItem: React.FC<DashboardScoreItemProps> = ({
    title,
    category,
    categoryScoreData,
    isExpanded,
    onToggleExpand,
    invertColorScale = false,
    icon: IconComponent,
    isPremiumDataFetchedAndHasData,
    epcBandData,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
    onItemValueClick,
    handleEpcValueChange,
    onOpenUpsellModal,
    crimeQuery,
    premiumStreetDataQuery,
    mobileCoverageAccordion,
    coastalErosionAccordion,
    floodRiskAccordion,
    crimeAccordion,
    planningPermissionAccordion,
    nearbyPlanningPermissionAccordion
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

    const { score, contributingItems, warningMessages, calculationStatus } = categoryScoreData;
    const hasContributingItems = contributingItems?.length > 0;

    const planningApplications = premiumStreetDataQuery.data?.premiumData?.data?.attributes?.planning_applications;
    const nearbyPlanningApplications = premiumStreetDataQuery.data?.premiumData?.data?.attributes?.nearby_planning_applications;

    return (
        <Accordion type="single" collapsible value={isExpanded ? category : ""} onValueChange={() => onToggleExpand(category)} className="w-full border rounded-lg overflow-hidden shadow-sm bg-white mb-1.5 last:mb-0">
            <AccordionItem value={category} className="border-b-0">
                <AccordionTrigger
                    className="px-3 py-2 hover:bg-slate-50 [&[data-state=open]]:bg-slate-50 group"
                >
                    <div className="grid grid-cols-[20px_90px_1fr] items-center w-full gap-x-3 mr-3">
                        {IconComponent && <IconComponent className="h-5 w-5 text-slate-600" />}
                        <h3 className="font-semibold text-slate-800 text-left max-w-[90px]">{title}</h3>
                        <div className="flex flex-col items-start">
                            {calculationStatus === CALCULATED_STATUS.CALCULATED && score ? (
                                <ScoreVisualisation score={score} invertColorScale={invertColorScale} showLabel={false} />
                            ) : (
                                <div
                                    className="h-2 w-full rounded-full my-1.5"
                                    style={{ background: DISABLED_BAR_BACKGROUND }}
                                ></div>
                            )}
                            <div className="flex items-center mt-1">
                                <span className="text-xs font-medium text-slate-600 text-left">
                                    {
                                        calculationStatus === CALCULATED_STATUS.CALCULATED && score?.scoreLabel
                                            ? score.scoreLabel
                                            : "Not Enough Data"
                                    }
                                </span>
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
                            {contributingItems.map((item) => (
                                <React.Fragment key={item.key}>
                                    <ChecklistItem
                                        item={item}
                                        isPremiumDataFetchedAndHasData={isPremiumDataFetchedAndHasData}
                                        epcBandData={item.key === CHECKLIST_KEYS.EPC ? epcBandData : undefined}
                                        epcDebugCanvasRef={epcDebugCanvasRef}
                                        isEpcDebugModeOn={isEpcDebugModeOn}
                                        onValueClick={() => onItemValueClick(item)}
                                        onEpcChange={handleEpcValueChange}
                                        onOpenUpsellModal={onOpenUpsellModal}
                                    />
                                    {item.key === CHECKLIST_KEYS.CRIME_SCORE && crimeAccordion?.isExpanded && crimeQuery.data && (
                                        <div
                                            ref={crimeAccordion?.contentRef}
                                            className="overflow-hidden transition-all duration-300 ease-in-out pt-2"
                                            style={{ maxHeight: crimeAccordion?.isExpanded && crimeAccordion?.contentHeight ? `${crimeAccordion.contentHeight}px` : "0px" }}
                                        >
                                            <Suspense fallback={<LoadingSpinner />}>
                                                <LazyCrimePieChart
                                                    crimeSummary={crimeQuery.data.crimeSummary}
                                                    totalCrimes={crimeQuery.data.totalCrimes}
                                                    trendingPercentageOver6Months={crimeQuery.data.trendingPercentageOver6Months}
                                                />
                                            </Suspense>
                                        </div>
                                    )}
                                    {item.key === CHECKLIST_KEYS.PLANNING_PERMISSIONS && planningPermissionAccordion?.isExpanded && planningApplications && (
                                        <div
                                            ref={planningPermissionAccordion?.contentRef}
                                            className="overflow-hidden transition-all duration-300 ease-in-out pt-2"
                                            style={{ maxHeight: planningPermissionAccordion?.isExpanded && planningPermissionAccordion?.contentHeight ? `${planningPermissionAccordion.contentHeight}px` : "0px" }}
                                        >
                                            <Suspense fallback={<LoadingSpinner />}>
                                                <LazyPlanningPermissionCard
                                                    planningPermissionData={planningApplications}
                                                    isLoading={premiumStreetDataQuery.isLoading}
                                                    displayMode="property"
                                                />
                                            </Suspense>
                                        </div>
                                    )}
                                    {item.key === CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS && nearbyPlanningPermissionAccordion?.isExpanded && nearbyPlanningApplications && (
                                        <div
                                            ref={nearbyPlanningPermissionAccordion?.contentRef}
                                            className="overflow-hidden transition-all duration-300 ease-in-out pt-2"
                                            style={{ maxHeight: nearbyPlanningPermissionAccordion?.isExpanded && nearbyPlanningPermissionAccordion?.contentHeight ? `${nearbyPlanningPermissionAccordion.contentHeight}px` : "0px" }}
                                        >
                                            <Suspense fallback={<LoadingSpinner />}>
                                                <LazyPlanningPermissionCard
                                                    nearbyPlanningPermissionData={nearbyPlanningApplications}
                                                    isLoading={premiumStreetDataQuery.isLoading}
                                                    displayMode="nearby"
                                                />
                                            </Suspense>
                                        </div>
                                    )}
                                    {item.key === CHECKLIST_KEYS.COASTAL_EROSION && coastalErosionAccordion?.isExpanded && item.coastalErosionDetails && (
                                        <div
                                            ref={coastalErosionAccordion?.contentRef}
                                            className="overflow-hidden transition-all duration-300 ease-in-out pt-2"
                                            style={{ maxHeight: coastalErosionAccordion?.isExpanded && coastalErosionAccordion?.contentHeight ? `${coastalErosionAccordion.contentHeight}px` : "0px" }}
                                        >
                                            <Suspense fallback={<LoadingSpinner />}>
                                                <LazyCoastalErosionDisplay coastalErosionDetails={item.coastalErosionDetails} />
                                            </Suspense>
                                        </div>
                                    )}
                                    {item.key === CHECKLIST_KEYS.MOBILE_COVERAGE && mobileCoverageAccordion?.isExpanded && item.mobileCoverage && (
                                        <div
                                            ref={mobileCoverageAccordion?.contentRef}
                                            className="overflow-hidden transition-all duration-300 ease-in-out pt-2 mt-1 border-t border-slate-200"
                                            style={{ maxHeight: mobileCoverageAccordion?.isExpanded && mobileCoverageAccordion?.contentHeight ? `${mobileCoverageAccordion.contentHeight}px` : "0px" }}
                                        >
                                            <Suspense fallback={<LoadingSpinner />}>
                                                <LazyMobileCoverageDisplay mobileCoverage={item.mobileCoverage} />
                                            </Suspense>
                                        </div>
                                    )}
                                    {item.key === CHECKLIST_KEYS.FLOOD_RISK && floodRiskAccordion?.isExpanded && item?.completeFloodRiskAssessment && (
                                        <div
                                            ref={floodRiskAccordion?.contentRef}
                                            className="overflow-hidden transition-all duration-300 ease-in-out pt-2"
                                            style={{ maxHeight: floodRiskAccordion?.isExpanded && floodRiskAccordion?.contentHeight ? `${floodRiskAccordion.contentHeight}px` : "0px" }}
                                        >
                                            <Suspense fallback={<LoadingSpinner />}>
                                                <LazyFloodRiskDisplay completeFloodRiskAssessment={item.completeFloodRiskAssessment} />
                                            </Suspense>
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground py-2">No contributing items for this category.</p>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}; 