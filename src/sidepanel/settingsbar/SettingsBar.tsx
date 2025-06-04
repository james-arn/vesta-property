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
              <Button
                size="default"
                variant="default"
                onClick={onPremiumSearchClick}
                className="relative flex items-center gap-2 bg-gradient-to-r from-[#B8860B] via-[#DAA520] to-[#B8860B] hover:from-[#986C08] hover:via-[#B8860B] hover:to-[#986C08] transition-all duration-300 border border-[#FFD700]/30 shadow-[0_2px_10px_rgba(255,215,0,0.15)] text-white font-medium py-2 px-4"
              >
                <div className="flex items-center gap-2 z-10">
                  <FaSearchPlus className="h-4 w-4" />
                  <span className="font-semibold tracking-wide">Premium Search</span>
                </div>
                <div className="absolute inset-0 overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-r from-transparent via-[#FFD700]/20 to-transparent -translate-x-full animate-shimmer"></div>
                </div>
              </Button>
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
