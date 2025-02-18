import React from "react";
import { IoWarning, IoWarningOutline } from "react-icons/io5";
import { FilterControlsProps } from "./FilterControls";

interface AskAgentOnlyControlProps {
    isDisabled: boolean;
    toggleFilter: (filterName: keyof FilterControlsProps["filters"]) => void;
    filters: { showAskAgentOnly: boolean };
}

const AskAgentOnlyControl: React.FC<AskAgentOnlyControlProps> = ({
    isDisabled,
    toggleFilter,
    filters,
}) => {
    const handleClick = () => {
        if (!isDisabled) {
            toggleFilter("showAskAgentOnly");
        }
    };

    return (
        <button onClick={handleClick} className="flex items-center w-full" disabled={isDisabled}>
            {filters.showAskAgentOnly ? (
                <IoWarning size={20} color="orange" />
            ) : (
                <IoWarningOutline size={20} />
            )}
            <span className="ml-2">
                {filters.showAskAgentOnly ? "Show all items" : "Show ask agent only"}
            </span>
        </button>
    );
};

export default AskAgentOnlyControl;