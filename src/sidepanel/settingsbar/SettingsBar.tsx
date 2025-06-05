import { PremiumButton } from "@/components/PremiumButton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import VIEWS from "@/constants/views";
import { AgentDetails } from "@/types/property";
import React from "react";
import { FaPaperPlane, FaSearchPlus } from "react-icons/fa";
import { FilterControls } from "./FilterControls";
import SettingsControls from "./SettingsControls";

interface SettingsBarProps {
  openGroups: { [key: string]: boolean };
  setOpenGroups: (openGroups: { [key: string]: boolean }) => void;
  propertyChecklistData: { group: string }[];
  filters: { showAskAgentOnly: boolean };
  toggleFilter: (filterName: keyof SettingsBarProps["filters"]) => void;
  agentDetails: AgentDetails | null;
  currentView: typeof VIEWS[keyof typeof VIEWS];
  setCurrentView: (view: typeof VIEWS[keyof typeof VIEWS]) => void;
  onGenerateMessageClick: () => void;
  onPremiumSearchClick: () => void;
}

const SettingsBar: React.FC<SettingsBarProps> = ({
  openGroups,
  setOpenGroups,
  propertyChecklistData,
  filters,
  toggleFilter,
  agentDetails,
  currentView,
  setCurrentView,
  onGenerateMessageClick,
  onPremiumSearchClick,
}) => {
  return (
    <div className="flex justify-between items-center p-2 bg-gray-100 rounded-md shadow-md space-x-4">
      <div className="flex items-center space-x-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <PremiumButton
                icon={<FaSearchPlus className="h-4 w-4" />}
                text="Premium Search"
                tooltipText="Unlock enhanced property data with Premium Search"
                onClick={onPremiumSearchClick}
              />
            </TooltipTrigger>
            <TooltipContent sideOffset={5} className="bg-slate-900 text-white">
              <p>Unlock enhanced property data with Premium Search</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                onClick={onGenerateMessageClick}
              >
                <FaPaperPlane className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Create an agent message with a list of questions<br />on missing listing information</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center space-x-2 ml-auto">
        <FilterControls
          filters={filters}
          toggleFilter={toggleFilter}
          openGroups={openGroups}
          setOpenGroups={setOpenGroups}
          propertyChecklistData={propertyChecklistData}
        />
        <SettingsControls />
      </div>
    </div>
  );
};

export default SettingsBar;
