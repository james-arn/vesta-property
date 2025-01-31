import React from 'react';
import { IoWarning, IoWarningOutline } from "react-icons/io5";

interface FilterControlsProps {
    filters: { showAskAgentOnly: boolean; };
    toggleFilter: (filterName: keyof FilterControlsProps['filters']) => void;
}

export const FilterControls = ({ filters, toggleFilter }: FilterControlsProps) => {
    return (
        <button
            onClick={() => toggleFilter('showAskAgentOnly')}
            style={{ margin: "10px", cursor: "pointer", background: 'none' }}>
            {filters.showAskAgentOnly ? <IoWarning /> : <IoWarningOutline />}
        </button>
    );
};
