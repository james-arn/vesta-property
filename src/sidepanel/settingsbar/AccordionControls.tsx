import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import React from 'react';
import { VscCollapseAll, VscExpandAll } from 'react-icons/vsc';

interface AccordionControlsProps {
    openGroups: { [key: string]: boolean };
    setOpenGroups: (openGroups: { [key: string]: boolean }) => void;
    propertyChecklistData: { group: string }[];
}

const AccordionControls: React.FC<AccordionControlsProps> = ({ openGroups, setOpenGroups, propertyChecklistData }) => {
    const allGroupsOpen = Object.values(openGroups).every(Boolean);

    const expandAll = () => {
        const allOpenGroups = propertyChecklistData.reduce((acc, item) => {
            acc[item.group] = true;
            return acc;
        }, {} as { [key: string]: boolean });
        setOpenGroups(allOpenGroups);
    };

    const collapseAll = () => {
        const allClosedGroups = propertyChecklistData.reduce((acc, item) => {
            acc[item.group] = false;
            return acc;
        }, {} as { [key: string]: boolean });
        setOpenGroups(allClosedGroups);
    };

    return (
        <div>
            <TooltipProvider>
                {allGroupsOpen ?
                    <Tooltip>
                        <TooltipTrigger>
                            <div onClick={collapseAll} className="cursor-pointer bg-none border-none">
                                <VscCollapseAll size={20} />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Collapse All</p>
                        </TooltipContent>
                    </Tooltip>
                    :
                    <Tooltip>
                        <TooltipTrigger>
                            <div onClick={expandAll} className="cursor-pointer bg-none border-none">
                                <VscExpandAll size={20} />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Expand All</p>
                        </TooltipContent>
                    </Tooltip>
                }
            </TooltipProvider>
        </div>
    );
};

export default AccordionControls; 