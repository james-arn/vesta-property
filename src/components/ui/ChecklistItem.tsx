import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getStatusIcon } from "@/sidepanel/helpers";
import { DataStatus, PropertyDataList } from "@/types/property";
import React from "react";
import { FaInfoCircle } from "react-icons/fa";

export interface ChecklistItemProps {
    item: PropertyDataList;
    isSelected: boolean;
    onItemClick?: () => void;
    onValueClick?: () => void;
}

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
    item,
    isSelected,
    onItemClick,
    onValueClick,
}) => {
    const isWarning = item.status === DataStatus.ASK_AGENT;

    // Function to render the value content based on the item key.
    const renderValue = () => {
        if ((item.key === "epc" || item.key === "floorPlan") && item.value !== "Not mentioned") {
            return (
                <span onClick={onValueClick} className="cursor-pointer text-blue-500 underline">
                    Yes
                </span>
            );
        }
        // For crimeScore, we expect a clickable link that toggles inline expansion.
        if (item.key === "crimeScore") {
            return (
                <span onClick={onValueClick} className="cursor-pointer text-blue-500 underline">
                    {item.value || "Not found"}
                </span>
            );
        }
        return <span>{item.value || "Not found"}</span>;
    };

    return (
        <li
            onClick={onItemClick}
            className={`grid grid-cols-[1rem_90px_1fr_2rem] items-center p-2 bg-gray-100 rounded-md my-1 ${isWarning ? "border border-yellow-400" : ""
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