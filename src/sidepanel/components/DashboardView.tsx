import React, { useMemo } from 'react';
// Correct import path and type
import { PropertyDataListItem } from '@/types/property';
// Placeholder imports - uncomment later
// import { calculateDashboardScores } from '../helpers/dashboardHelpers';
import { DashboardScoreCategory } from '@/constants/dashboardConsts';
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { getCategoryDisplayName } from '@/sidepanel/helpers';
import { calculateDashboardScores } from '@/utils/scoreCalculations';
import {
    BadgeDollarSign, // Example for Safety
    Construction, // Example for Risk
    HeartPulse, // Example for Value
    ListChecks, // Example for Completeness
    PoundSterling, // Example for Running Costs
    ShieldAlert
} from 'lucide-react';
import { DashboardScoreItem } from './DashboardScoreItem';

type GetValueClickHandlerType = (
    item: PropertyDataListItem,
    openNewTab: (url: string) => void,
    toggleCrimeChart: () => void,
    togglePlanningPermissionCard: () => void,
    toggleNearbyPlanningPermissionCard?: () => void
) => (() => void) | undefined;

interface DashboardViewProps {
    checklistsData: PropertyDataListItem[] | null;
    isPremiumDataFetched: boolean;
    processedEpcResult?: EpcProcessorResult;
    epcDebugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
    isEpcDebugModeOn: boolean;
    getValueClickHandler: GetValueClickHandlerType;
    openNewTab: (url: string) => void;
    toggleCrimeChart: () => void;
    togglePlanningPermissionCard: () => void;
    toggleNearbyPlanningPermissionCard?: () => void;
    handleEpcValueChange: (newValue: string) => void;
}

// Map categories to icons
const categoryIcons: { [key in DashboardScoreCategory]?: React.ElementType } = {
    [DashboardScoreCategory.RUNNING_COSTS]: PoundSterling,
    [DashboardScoreCategory.RISK]: ShieldAlert,
    [DashboardScoreCategory.SAFETY]: HeartPulse,
    [DashboardScoreCategory.CONDITION]: Construction,
    [DashboardScoreCategory.VALUE_FOR_MONEY]: BadgeDollarSign,
    [DashboardScoreCategory.COMPLETENESS]: ListChecks,
};

export const DashboardView: React.FC<DashboardViewProps> = ({
    checklistsData,
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

    const dashboardScores = useMemo(() => calculateDashboardScores(checklistsData), [checklistsData]);

    if (!checklistsData) {
        return <div className="p-4 text-center text-muted-foreground">Loading dashboard data...</div>;
    }

    // Determine the order of categories for display
    const categoryOrder: DashboardScoreCategory[] = [
        DashboardScoreCategory.RUNNING_COSTS,
        DashboardScoreCategory.RISK,
        DashboardScoreCategory.SAFETY, // Placeholder
        DashboardScoreCategory.CONDITION, // Placeholder
        DashboardScoreCategory.VALUE_FOR_MONEY, // Placeholder
        DashboardScoreCategory.COMPLETENESS,
    ];

    return (
        <div className="dashboard-view p-4 space-y-2">
            {categoryOrder.map((category) => {
                const categoryScoreData = dashboardScores[category];
                const title = getCategoryDisplayName(category);
                const IconComponent = categoryIcons[category]; // Get the icon component

                // Determine if the color scale should be inverted for this category
                const invertColorScale =
                    category === DashboardScoreCategory.RISK ||
                    category === DashboardScoreCategory.RUNNING_COSTS;

                // Skip rendering if score data is missing (unless it's completeness which handles its own undefined state)
                if (!categoryScoreData && category !== DashboardScoreCategory.COMPLETENESS) {
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
                        epcData={processedEpcResult}
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