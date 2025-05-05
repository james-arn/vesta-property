import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import React from "react";
import { VscFilter } from "react-icons/vsc";
import AskAgentOnlyControl from "./AskAgentOnlyControl";
import ExpandCollapseControl from "./ExpandCollapseControl";

export interface FilterControlsProps {
  filters: { showAskAgentOnly: boolean };
  toggleFilter: (filterName: keyof FilterControlsProps["filters"]) => void;
  openGroups: { [key: string]: boolean };
  setOpenGroups: (openGroups: { [key: string]: boolean }) => void;
  propertyChecklistData: { group: string }[];
}

export const FilterControls = ({
  filters,
  toggleFilter,
  openGroups,
  setOpenGroups,
  propertyChecklistData,
}: FilterControlsProps) => {
  const isFilterDisabled = false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="group cursor-pointer">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <VscFilter size={20} />
              </TooltipTrigger>
              <TooltipContent>
                <p>Filter options</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <ExpandCollapseControl
              openGroups={openGroups}
              setOpenGroups={setOpenGroups}
              propertyChecklistData={propertyChecklistData}
            />
          </DropdownMenuItem>
          <DropdownMenuItem>
            <AskAgentOnlyControl
              isDisabled={isFilterDisabled}
              toggleFilter={toggleFilter}
              filters={filters}
            />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default FilterControls;
