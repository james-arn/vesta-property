import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ACCORDION_IDS, AccordionId } from "@/constants/accordionKeys";
import { DashboardScoreCategory } from '@/constants/dashboardScoreCategoryConsts';
import { ENV_CONFIG } from "@/constants/environmentConfig";
import { useAccordion } from '@/hooks/useAccordion';
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

interface DashboardViewProps {
    checklistsData: PropertyDataListItem[] | null;
    categoryScores: DashboardScores;
    overallScore: number | null;
    dataCoverageScoreData: CategoryScoreData | undefined;
    isLoading: boolean;
    onItemValueClick: (item: PropertyDataListItem) => void;
    openNewTab: (url: string) => void;
    isPremiumDataFetchedAndHasData: boolean;
    epcBandData?: EpcBandResult | undefined;
    epcDebugCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    isEpcDebugModeOn: boolean;
    handleEpcValueChange: (newValue: string) => void;
    crimeQuery: UseQueryResult<CrimeScoreData, Error>;
    premiumStreetDataQuery: UseQueryResult<
        GetPremiumStreetDataResponse | null,
        Error
    >;
    onTriggerPremiumFlow: () => void;
    accordions: Record<AccordionId, ReturnType<typeof useAccordion>>;
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
    openNewTab,
    onItemValueClick,
    crimeQuery,
    premiumStreetDataQuery,
    onTriggerPremiumFlow,
    isPremiumDataFetchedAndHasData,
    epcBandData,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
    handleEpcValueChange,
    accordions
}) => {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const handleToggleExpand = (category: string) => {
        const isClosing = expandedCategory === category;

        if (!isClosing) {
            Object.values(accordions).forEach(accordion => {
                accordion.setIsExpanded(false);
            });
        }

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
        DashboardScoreCategory.DATA_COVERAGE,
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
                    if (category === DashboardScoreCategory.DATA_COVERAGE) {
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
                                onItemValueClick={onItemValueClick}
                                isPremiumDataFetchedAndHasData={isPremiumDataFetchedAndHasData}
                                upgradeUrl={upgradeUrl}
                                crimeQuery={crimeQuery}
                                premiumStreetDataQuery={premiumStreetDataQuery}
                                crimeAccordion={accordions[ACCORDION_IDS.CRIME]}
                                planningPermissionAccordion={accordions[ACCORDION_IDS.PLANNING_PERMISSION]}
                                nearbyPlanningPermissionAccordion={accordions[ACCORDION_IDS.NEARBY_PLANNING_PERMISSION]}
                                onOpenUpsellModal={onTriggerPremiumFlow}
                                handleEpcValueChange={handleEpcValueChange}
                                epcBandData={epcBandData}
                                epcDebugCanvasRef={epcDebugCanvasRef}
                                isEpcDebugModeOn={isEpcDebugModeOn}
                                invertColorScale={false}
                                mobileCoverageAccordion={accordions[ACCORDION_IDS.MOBILE_COVERAGE]}
                                coastalErosionAccordion={accordions[ACCORDION_IDS.COASTAL_EROSION]}
                                floodRiskAccordion={accordions[ACCORDION_IDS.FLOOD_RISK]}
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