import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import React from 'react';
import { IoWarning, IoWarningOutline } from "react-icons/io5";


interface FilterControlsProps {
    filters: { showAskAgentOnly: boolean; };
    toggleFilter: (filterName: keyof FilterControlsProps['filters']) => void;
}

export const FilterControls = ({ filters, toggleFilter }: FilterControlsProps) => {
    const showAllTitle = "Show all items";
    const showAskAgentTitle = "Show ask agent items only";

    const currentTitle = filters.showAskAgentOnly ? showAllTitle : showAskAgentTitle;
    const CurrentIcon = filters.showAskAgentOnly ? <IoWarning size={20} color="orange" /> : <IoWarningOutline size={20} />;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <button
                        onClick={() => toggleFilter('showAskAgentOnly')}
                        className="cursor-pointer bg-none">
                        {CurrentIcon}
                    </button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{currentTitle}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
