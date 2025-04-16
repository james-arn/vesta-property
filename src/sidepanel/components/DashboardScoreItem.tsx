import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { ChecklistItem } from '@/components/ui/ChecklistItem';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DASHBOARD_CATEGORY_DISPLAY_NAMES, DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { CategoryScoreData, DataStatus, PropertyDataListItem } from '@/types/property';
import React from 'react';
import { FaExclamationTriangle } from "react-icons/fa";
import { ScoreVisualisation } from './ScoreVisualisation';

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
    handleEpcValueChange
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

    const { score, contributingItems, warningMessage } = categoryScoreData;
    const relevantContributingItems = contributingItems.filter(item => {
        if (title === DASHBOARD_CATEGORY_DISPLAY_NAMES[DashboardScoreCategory.LISTING_COMPLETENESS]) {
            return item.status === DataStatus.ASK_AGENT;
        }
        if (title === DASHBOARD_CATEGORY_DISPLAY_NAMES[DashboardScoreCategory.LEGAL_CONSTRAINTS] && item.key === 'tenure' && item.status === DataStatus.FOUND_POSITIVE) {
            return false;
        }
        return true;
    });

    const hasRelevantContributingItems = relevantContributingItems && relevantContributingItems.length > 0;

    return (
        <Accordion type="single" collapsible className="w-full border rounded-lg overflow-hidden shadow-sm bg-white">
            <AccordionItem value={title} className="border-b-0">
                <AccordionTrigger className="px-3 py-3 hover:bg-slate-50 [&[data-state=open]]:bg-slate-50 [&[data-state=open]]:border-b border-slate-100">
                    <div className="flex items-start w-full">
                        {IconComponent && <IconComponent className="h-5 w-5 mr-3 text-slate-600 shrink-0" />}
                        <div className="flex flex-col w-full text-left">
                            <h3 className="font-semibold text-slate-800 mb-1.5">{title}</h3>
                            <div className="flex items-center space-x-2 mr-1.5">
                                <ScoreVisualisation score={score} invertColorScale={invertColorScale} />
                                {warningMessage && (
                                    <TooltipProvider>
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <FaExclamationTriangle className="h-3 w-3 shrink-0 text-yellow-500" />
                                            </TooltipTrigger>
                                            <TooltipContent side="top" align="center">
                                                <p className="max-w-xs text-sm">{warningMessage}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="bg-slate-50/50 border-t border-slate-100">
                    {hasRelevantContributingItems ? (
                        <ul className="list-none p-0 m-0 space-y-1">
                            {relevantContributingItems.map(item => {
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
                                        epcData={item.key === 'epc' ? epcData : undefined}
                                        epcDebugCanvasRef={epcDebugCanvasRef}
                                        isEpcDebugModeOn={isEpcDebugModeOn}
                                        onValueClick={handleClick}
                                        onEpcChange={handleEpcValueChange}
                                    />
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">No specific contributing factors identified.</p>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}; 