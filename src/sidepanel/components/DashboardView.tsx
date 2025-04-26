import React, { lazy, Suspense } from 'react';
// Correct import path and type
import { DashboardScores, PropertyDataListItem } from '@/types/property';
// Placeholder imports - uncomment later
// import { calculateDashboardScores } from '../helpers/dashboardHelpers';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import { DashboardScoreCategory } from '@/constants/dashboardScoreCategoryConsts';
import { ENV_CONFIG } from "@/constants/environmentConfig";
import { CrimeScoreData } from "@/hooks/useCrimeScore";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { getCategoryDisplayName } from '@/sidepanel/helpers';
import { PremiumStreetDataResponse } from "@/types/premiumStreetData";
import { UseQueryResult } from '@tanstack/react-query';
import {
    Home,
    Network,
    PoundSterling,
    Scale,
    ShieldAlert,
    TrendingUp
} from 'lucide-react';
import { calculateOverallScore } from '../helpers/dashboardHelpers';
import { DashboardScoreItem } from './DashboardScoreItem';
import { DashboardTile } from './DashboardTile';

interface DashboardCalculationData {
    calculatedLeaseMonths: number | null;
    epcScoreForCalculation: number;
}

type GetValueClickHandlerType = (
    item: PropertyDataListItem,
    openNewTab: (url: string) => void,
    toggleCrimeChart: () => void,
    togglePlanningPermissionCard: () => void,
    toggleNearbyPlanningPermissionCard?: () => void
) => (() => void) | undefined;

// Dynamically import charts and cards
const LazyCrimePieChart = lazy(() => import('@/components/ui/CrimePieChart'));
const LazyPlanningPermissionCard = lazy(() => import('@/components/ui/Premium/PlanningPermission/PlanningPermissionCard'));

interface DashboardViewProps {
    checklistsData: PropertyDataListItem[] | null;
    dashboardScores: DashboardScores;
    isPremiumDataFetched: boolean;
    processedEpcResult?: EpcProcessorResult | null;
    epcDebugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
    isEpcDebugModeOn: boolean;
    getValueClickHandler: GetValueClickHandlerType;
    openNewTab: (url: string) => void;
    toggleCrimeChart: () => void;
    togglePlanningPermissionCard: () => void;
    toggleNearbyPlanningPermissionCard?: () => void;
    handleEpcValueChange: (newValue: string) => void;

    // Expansion state and refs
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
    onTriggerPremiumFlow: () => void;
}

const categoryIcons: { [key in DashboardScoreCategory]?: React.ElementType } = {
    [DashboardScoreCategory.RUNNING_COSTS]: PoundSterling,
    [DashboardScoreCategory.INVESTMENT_VALUE]: TrendingUp,
    [DashboardScoreCategory.CONNECTIVITY]: Network,
    [DashboardScoreCategory.CONDITION]: Home,
    [DashboardScoreCategory.ENVIRONMENT_RISK]: ShieldAlert,
    [DashboardScoreCategory.LEGAL_CONSTRAINTS]: Scale,
};

export const DashboardView: React.FC<DashboardViewProps> = ({
    checklistsData,
    dashboardScores,
    isPremiumDataFetched,
    processedEpcResult,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
    getValueClickHandler,
    openNewTab,
    toggleCrimeChart,
    togglePlanningPermissionCard,
    toggleNearbyPlanningPermissionCard,
    handleEpcValueChange,
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
    onTriggerPremiumFlow
}) => {
    const upgradeUrl = ENV_CONFIG.AUTH_PRICING_URL;

    const hasDashboardScores = Object.keys(dashboardScores).length > 0;

    if (!checklistsData || !hasDashboardScores) {
        return <div className="p-4 text-center text-muted-foreground">
            {!checklistsData ? "Loading checklist data..." : "Calculating dashboard scores..."}
        </div>;
    }

    const overallScore = calculateOverallScore(dashboardScores);
    const dataCoverageScoreData = dashboardScores[DashboardScoreCategory.LISTING_COMPLETENESS];
    const dataCoverageScoreValue = dataCoverageScoreData?.score?.scoreValue ?? null;

    const categoryOrder: DashboardScoreCategory[] = [
        DashboardScoreCategory.RUNNING_COSTS,
        DashboardScoreCategory.INVESTMENT_VALUE,
        DashboardScoreCategory.CONNECTIVITY,
        DashboardScoreCategory.CONDITION,
        DashboardScoreCategory.ENVIRONMENT_RISK,
        DashboardScoreCategory.LEGAL_CONSTRAINTS,
        DashboardScoreCategory.LISTING_COMPLETENESS,
    ];

    // Define tooltip content
    const overallScoreTooltip = (
        <p>Average score across Running Costs, Investment Value, Connectivity, Condition, Environment Risk, and Legal Constraints.</p>
    );
    const dataCoverageTooltip = (
        <>
            <p>Score reflects completeness of standard listing information found.</p>
            <p className="mt-1">Additional premium data points (e.g., planning history, crime details) are available.</p>
        </>
    );

    return (
        <TooltipProvider delayDuration={300}>
            <div className="dashboard-view space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <DashboardTile
                        title="Overall Score"
                        scoreValue={overallScore}
                        tooltipContent={overallScoreTooltip}
                    />
                    <DashboardTile
                        title="Data Coverage"
                        scoreValue={dataCoverageScoreValue}
                        tooltipContent={dataCoverageTooltip}
                    />
                </div>

                <div>
                    {categoryOrder.map((category) => {
                        const categoryScoreData = dashboardScores[category];
                        if (!categoryScoreData) {
                            console.warn(`DashboardView: Missing score data for category: ${category}`);
                            return null;
                        }
                        if (category === DashboardScoreCategory.LISTING_COMPLETENESS) {
                            return null;
                        }
                        const title = getCategoryDisplayName(category);
                        const IconComponent = categoryIcons[category];

                        const invertColorScale =
                            category === DashboardScoreCategory.RUNNING_COSTS ||
                            category === DashboardScoreCategory.ENVIRONMENT_RISK ||
                            category === DashboardScoreCategory.LEGAL_CONSTRAINTS;

                        return (
                            <DashboardScoreItem
                                key={category}
                                title={title}
                                categoryScoreData={categoryScoreData}
                                invertColorScale={invertColorScale}
                                icon={IconComponent}
                                isPremiumDataFetched={isPremiumDataFetched}
                                upgradeUrl={upgradeUrl}
                                epcData={processedEpcResult ?? undefined}
                                epcDebugCanvasRef={epcDebugCanvasRef}
                                isEpcDebugModeOn={isEpcDebugModeOn}
                                getValueClickHandler={getValueClickHandler}
                                openNewTab={openNewTab}
                                toggleCrimeChart={toggleCrimeChart}
                                togglePlanningPermissionCard={togglePlanningPermissionCard}
                                toggleNearbyPlanningPermissionCard={toggleNearbyPlanningPermissionCard}
                                handleEpcValueChange={handleEpcValueChange}
                                crimeQuery={crimeQuery}
                                premiumStreetDataQuery={premiumStreetDataQuery}
                                crimeChartExpanded={crimeChartExpanded}
                                crimeContentRef={crimeContentRef}
                                crimeContentHeight={crimeContentHeight}
                                planningPermissionCardExpanded={planningPermissionCardExpanded}
                                planningPermissionContentRef={planningPermissionContentRef}
                                planningPermissionContentHeight={planningPermissionContentHeight}
                                nearbyPlanningPermissionCardExpanded={nearbyPlanningPermissionCardExpanded}
                                nearbyPlanningPermissionContentRef={nearbyPlanningPermissionContentRef}
                                nearbyPlanningPermissionContentHeight={nearbyPlanningPermissionContentHeight}
                                onOpenUpsellModal={onTriggerPremiumFlow}
                            />
                        );
                    })}
                </div>

                {premiumStreetDataQuery.data?.data?.attributes?.planning_applications && (
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
                {premiumStreetDataQuery.data?.data?.attributes?.nearby_planning_applications && (
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

                {Object.keys(dashboardScores).length === 0 && checklistsData && (
                    <p className="text-center text-muted-foreground">Could not calculate dashboard scores.</p>
                )}
            </div>
        </TooltipProvider>
    );
}; 