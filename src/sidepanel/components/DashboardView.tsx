import React from 'react';
// Correct import path and type
import { DashboardScores, PropertyDataListItem } from '@/types/property';
// Placeholder imports - uncomment later
// import { calculateDashboardScores } from '../helpers/dashboardHelpers';
import { DashboardScoreCategory } from '@/constants/dashboardScoreCategoryConsts';
import { ENV_CONFIG } from "@/constants/environmentConfig";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { getCategoryDisplayName } from '@/sidepanel/helpers';
import {
    Home // Example for Condition
    , // Example for Value
    ListChecks, // Example for Risk
    Network, // Example for Completeness
    PoundSterling, // Example for Running Costs
    Scale, // Example for Legal Constraints
    ShieldAlert, // Example for Environmental Risk?
    TrendingUp
} from 'lucide-react';
import { DashboardScoreItem } from './DashboardScoreItem';

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
}

// Map NEW categories to icons
const categoryIcons: { [key in DashboardScoreCategory]?: React.ElementType } = {
    [DashboardScoreCategory.RUNNING_COSTS]: PoundSterling,
    [DashboardScoreCategory.INVESTMENT_VALUE]: TrendingUp,
    [DashboardScoreCategory.CONNECTIVITY]: Network,
    [DashboardScoreCategory.CONDITION]: Home,
    [DashboardScoreCategory.ENVIRONMENTAL_RISK]: ShieldAlert,
    [DashboardScoreCategory.LEGAL_CONSTRAINTS]: Scale,
    [DashboardScoreCategory.LISTING_COMPLETENESS]: ListChecks,
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
    handleEpcValueChange
}) => {
    // Define the upgrade URL from config here
    const upgradeUrl = ENV_CONFIG.AUTH_PRICING_URL;

    if (!checklistsData) {
        return <div className="p-4 text-center text-muted-foreground">Loading dashboard data...</div>;
    }

    const categoryOrder: DashboardScoreCategory[] = [
        DashboardScoreCategory.RUNNING_COSTS,
        DashboardScoreCategory.INVESTMENT_VALUE,
        DashboardScoreCategory.CONNECTIVITY,
        DashboardScoreCategory.CONDITION,
        DashboardScoreCategory.ENVIRONMENTAL_RISK,
        DashboardScoreCategory.LEGAL_CONSTRAINTS,
        DashboardScoreCategory.LISTING_COMPLETENESS,
    ];

    return (
        <div className="dashboard-view space-y-2">
            {categoryOrder.map((category) => {
                const categoryScoreData = dashboardScores[category];
                const title = getCategoryDisplayName(category);
                const IconComponent = categoryIcons[category];

                // Determine if the color scale should be inverted for this category
                const invertColorScale =
                    category === DashboardScoreCategory.RUNNING_COSTS ||
                    category === DashboardScoreCategory.ENVIRONMENTAL_RISK ||
                    category === DashboardScoreCategory.LEGAL_CONSTRAINTS;

                // Skip rendering if score data is missing (unless it's completeness which handles its own undefined state)
                if (!categoryScoreData && category !== DashboardScoreCategory.LISTING_COMPLETENESS) {
                    // Optionally render a placeholder or just skip
                    // console.log(`Skipping rendering for ${title} due to missing score data.`);
                    // return null; // Or render a placeholder item

                    // Render the item but let it display "Score data unavailable."
                }

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
                    />
                );
            })}

            {Object.keys(dashboardScores).length === 0 && !checklistsData && (
                <p className="text-center text-muted-foreground">Could not calculate dashboard scores.</p>
            )}
        </div>
    );
}; 