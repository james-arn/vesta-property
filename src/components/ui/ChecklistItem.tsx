import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isPremiumNoDataValue, PREMIUM_DATA_STATES, PREMIUM_PLACEHOLDER_DESCRIPTIONS, PropertyGroups } from "@/constants/propertyConsts";
import { getStatusIcon } from "@/sidepanel/helpers";
import { isClickableItemKey } from "@/types/clickableChecklist";
import { DataStatus } from "@/types/property";

import { PropertyDataList } from "@/types/property";
import React from "react";
import { FaInfoCircle, FaLock } from "react-icons/fa";

export interface ChecklistItemProps {
    item: PropertyDataList;
    isSelected: boolean;
    onItemClick?: () => void;
    onValueClick?: () => void;
    isPremiumDataFetched: boolean;
}

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
    item,
    isSelected,
    onItemClick,
    onValueClick,
    isPremiumDataFetched
}) => {
    const isWarning = item.status === DataStatus.ASK_AGENT;

    // Check if this is a premium item without proper data
    const isPremiumField = item.group === PropertyGroups.PREMIUM &&
        (item.status === DataStatus.IS_LOADING ||
            !item.value ||
            (typeof item.value === 'string' && isPremiumNoDataValue(item.value)));

    const renderValue = () => {
        const isClickable = isClickableItemKey(item.key)
            && item.value !== "Not mentioned"
            && item.status !== DataStatus.IS_LOADING;

        // If it's a premium item without a value yet, show the premium placeholder
        if (isPremiumField && !isPremiumDataFetched) {
            const premiumDescription = PREMIUM_PLACEHOLDER_DESCRIPTIONS[item.key] || `${item.label}: Unlock with Premium`;
            return (
                <div className="flex items-center text-gray-500">
                    <FaLock className="mr-2" size={12} />
                    <span>{premiumDescription}</span>
                </div>
            );
        }

        // Special case for EPC and floor plan - always show as "Yes" when clickable
        if ((item.key === "epc" || item.key === "floorPlan") && item.value !== "Not mentioned") {
            return (
                <span
                    onClick={onValueClick}
                    className="cursor-pointer text-blue-500 underline"
                >
                    Yes
                </span>
            );
        }

        // For crimeScore, we expect a clickable link that toggles inline expansion
        if (item.key === "crimeScore" && !isPremiumField) {
            return (
                <span
                    onClick={onValueClick}
                    className={`${item.status !== DataStatus.IS_LOADING ? "cursor-pointer text-blue-500 underline" : ""}`}
                >
                    {item.value || "Not found"}
                </span>
            );
        }

        // For planningPermissions and nearbyPlanningPermissions
        if ((item.key === "planningPermissions" || item.key === "nearbyPlanningPermissions") && isClickable && !isPremiumField) {
            // Don't make it clickable if no applications found
            const noApplicationsFound =
                item.value === PREMIUM_DATA_STATES.NO_APPLICATIONS ||
                item.value === PREMIUM_DATA_STATES.NO_NEARBY_APPLICATIONS;

            if (noApplicationsFound) {
                return <span>{item.value}</span>;
            }

            return (
                <span
                    onClick={onValueClick}
                    className="cursor-pointer text-blue-500 underline"
                >
                    {item.value || "Not found"}
                </span>
            );
        }

        // Log warning if this is a clickable key but we don't have specific rendering for it
        if (isClickableItemKey(item.key) && !isPremiumField &&
            item.key !== "epc" && item.key !== "floorPlan" &&
            item.key !== "crimeScore" && item.key !== "planningPermissions" &&
            item.key !== "nearbyPlanningPermissions") {
            console.error(`Key "${item.key}" is defined as clickable but has no special rendering in ChecklistItem`);
        }

        return <span>{item.value || "Not found"}</span>;
    };

    return (
        <li
            onClick={onItemClick}
            className={`grid grid-cols-[1rem_90px_1fr_2rem] items-center p-2 ${isPremiumField ? 'bg-gray-50 border border-gray-200' : 'bg-gray-100'} rounded-md my-1 ${isWarning ? "border border-yellow-400" : ""
                } ${isSelected ? "" : "opacity-30"}`}
        >
            <div className="flex items-center justify-start">
                {getStatusIcon(item.status)}
            </div>
            <div className="flex items-center ml-2">
                <span>{item.label}</span>
            </div>
            <div className="text-gray-800 ml-4">{renderValue()}</div>
            <div className="flex items-center justify-center ml-4">
                <TooltipProvider>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <FaInfoCircle className="cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="w-[200px] whitespace-pre-line">
                            {item.toolTipExplainer}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </li>
    );
};