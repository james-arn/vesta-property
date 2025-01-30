import React from 'react';
import { VscCollapseAll, VscExpandAll } from 'react-icons/vsc';

interface AccordionControlsProps {
    openGroups: { [key: string]: boolean };
    setOpenGroups: (openGroups: { [key: string]: boolean }) => void;
    updatedChecklist: { group: string }[];
}

const AccordionControls: React.FC<AccordionControlsProps> = ({ openGroups, setOpenGroups, updatedChecklist }) => {
    const allGroupsOpen = Object.values(openGroups).every(Boolean);

    const expandAll = () => {
        const allOpenGroups = updatedChecklist.reduce((acc, item) => {
            acc[item.group] = true;
            return acc;
        }, {} as { [key: string]: boolean });
        setOpenGroups(allOpenGroups);
    };

    const collapseAll = () => {
        const allClosedGroups = updatedChecklist.reduce((acc, item) => {
            acc[item.group] = false;
            return acc;
        }, {} as { [key: string]: boolean });
        setOpenGroups(allClosedGroups);
    };

    return (
        <div>
            {allGroupsOpen ?
                <button onClick={collapseAll} style={{ margin: "10px", cursor: "pointer", background: 'none', border: 'none' }}>
                    <VscCollapseAll size={20} title="Collapse All" />
                </button>
                :
                <button onClick={expandAll} style={{ margin: "10px", cursor: "pointer", background: 'none', border: 'none' }}>
                    <VscExpandAll size={20} title="Expand All" />
                </button>
            }
        </div>
    );
};

export default AccordionControls; 