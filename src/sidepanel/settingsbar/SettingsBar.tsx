import { STEPS } from "@/constants/steps";
import { AgentDetails } from "@/types/property";
import React from "react";
import { FilterControls } from "./FilterControls";
import NextStepButton from "./NextStepButton";
import SettingsControls from "./SettingsControls";
import TextInstructions from "./TextInstructions";

interface SettingsBarProps {
  openGroups: { [key: string]: boolean };
  setOpenGroups: (openGroups: { [key: string]: boolean }) => void;
  propertyChecklistData: { group: string }[];
  filters: { showAskAgentOnly: boolean };
  toggleFilter: (filterName: keyof SettingsBarProps["filters"]) => void;
  currentStep: keyof typeof STEPS;
  handleNext: () => void;
  agentDetails: AgentDetails | null;
}

const SettingsBar: React.FC<SettingsBarProps> = ({
  openGroups,
  setOpenGroups,
  propertyChecklistData,
  filters,
  toggleFilter,
  currentStep,
  handleNext,
  agentDetails,
}) => {
  return (
    <div className="flex justify-between items-center p-2 bg-gray-100 rounded-md shadow-md space-x-4">
      <TextInstructions currentStep={currentStep} agentDetails={agentDetails} />
      <NextStepButton currentStep={currentStep} onNext={handleNext} />
      <div className="flex flex-col space-y-1">
        <FilterControls
          currentStep={currentStep}
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
