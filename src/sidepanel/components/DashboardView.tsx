import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { DashboardScoreCategory } from '@/constants/dashboardScoreCategoryConsts';
import { ENV_CONFIG } from "@/constants/environmentConfig";
import { CrimeScoreData } from "@/hooks/useCrimeScore";
import { getCategoryDisplayName } from '@/sidepanel/helpers';
import { EpcBandResult } from "@/types/epc";
import {
    GetPremiumStreetDataResponse
} from "@/types/premiumStreetData";
import { CategoryScoreData, DashboardScores, PropertyDataListItem } from '@/types/property';
import { UseQueryResult } from '@tanstack/react-query';
import {
    Home,
    Network,
    PoundSterling,
    Scale,
    ShieldAlert,
    TrendingUp
} from 'lucide-react';
import React, { Suspense, useState } from 'react';
import { DashboardScoreItem } from './DashboardScoreItem';
import { DashboardTile } from './DashboardTile';

type GetValueClickHandlerType = (
    item: PropertyDataListItem,
    openNewTab: (url: string) => void,
    toggleCrimeChart: () => void,
    togglePlanningPermissionCard: (expand?: boolean) => void,
    toggleNearbyPlanningPermissionCard?: (expand?: boolean) => void
) => (() => void) | undefined;

interface DashboardViewProps {
    checklistsData: PropertyDataListItem[] | null;
    categoryScores: DashboardScores;
    overallScore: number | null;
    dataCoverageScoreData: CategoryScoreData | undefined;
    isLoading: boolean;
    getValueClickHandler: GetValueClickHandlerType;
    openNewTab: (url: string) => void;
    toggleCrimeChart: () => void;
    togglePlanningPermissionCard: (expand?: boolean) => void;
    toggleNearbyPlanningPermissionCard?: (expand?: boolean) => void;
    isPremiumDataFetched: boolean;
    epcBandData?: EpcBandResult | undefined;
    epcDebugCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    isEpcDebugModeOn: boolean;
    handleEpcValueChange: (newValue: string) => void;

    // Expansion state and refs
    crimeQuery: UseQueryResult<CrimeScoreData, Error>;
    premiumStreetDataQuery: UseQueryResult<
        GetPremiumStreetDataResponse | null,
        Error
    >;
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
    categoryScores,
    overallScore,
    dataCoverageScoreData,
    isLoading,
    getValueClickHandler,
    openNewTab,
    toggleCrimeChart,
    togglePlanningPermissionCard,
    toggleNearbyPlanningPermissionCard,
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
    isPremiumDataFetched,
    epcBandData,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
    handleEpcValueChange
}) => {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const handleToggleExpand = (category: string) => {
        const isClosing = expandedCategory === category;
        const nextCategory = isClosing ? null : category;
        setExpandedCategory(nextCategory);
    };

    const upgradeUrl = ENV_CONFIG.AUTH_PRICING_URL;

    const hasCategoryScores = Object.keys(categoryScores).length > 0;

    if (!checklistsData || !hasCategoryScores) {
        return <div className="p-4 text-center text-muted-foreground">
            {!checklistsData ? "Loading checklist data..." : "Calculating dashboard scores..."}
        </div>;
    }

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
                    const categoryScoreData = categoryScores[category];
                    if (!categoryScoreData) {
                        console.warn(`DashboardView: Missing score data for category: ${category}`);
                        return null;
                    }
                    if (category === DashboardScoreCategory.LISTING_COMPLETENESS) {
                        return null;
                    }
                    const title = getCategoryDisplayName(category);
                    const IconComponent = categoryIcons[category];
                    const isExpanded = expandedCategory === category;

                    return (
                        <Suspense fallback={<LoadingSpinner />} key={category}>
                            <DashboardScoreItem
                                category={category}
                                isExpanded={isExpanded}
                                onToggleExpand={handleToggleExpand}
                                title={title}
                                categoryScoreData={categoryScoreData}
                                icon={IconComponent}
                                getValueClickHandler={getValueClickHandler}
                                openNewTab={openNewTab}
                                toggleCrimeChart={toggleCrimeChart}
                                togglePlanningPermissionCard={togglePlanningPermissionCard}
                                toggleNearbyPlanningPermissionCard={toggleNearbyPlanningPermissionCard}
                                isPremiumDataFetched={isPremiumDataFetched}
                                upgradeUrl={upgradeUrl}
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
                                handleEpcValueChange={handleEpcValueChange}
                                epcBandData={epcBandData}
                                epcDebugCanvasRef={epcDebugCanvasRef}
                                isEpcDebugModeOn={isEpcDebugModeOn}
                                invertColorScale={false}
                            />
                        </Suspense>
                    );
                })}
            </div>

            {Object.keys(categoryScores).length === 0 && checklistsData && (
                <p className="text-center text-muted-foreground">Could not calculate dashboard scores.</p>
            )}
        </div>
    );
}; 