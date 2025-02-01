import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STEPS } from "@/constants/steps";
import React from "react";
import { IoWarning, IoWarningOutline } from "react-icons/io5";

interface FilterControlsProps {
  currentStep: keyof typeof STEPS;
  filters: { showAskAgentOnly: boolean };
  toggleFilter: (filterName: keyof FilterControlsProps["filters"]) => void;
}

export const FilterControls = ({
  currentStep,
  filters,
  toggleFilter,
}: FilterControlsProps) => {
  const showAllTitle = "Show all items";
  const showAskAgentTitle = "Show ask agent items only";

  const currentTitle = filters.showAskAgentOnly
    ? showAllTitle
    : showAskAgentTitle;
  const CurrentIcon = filters.showAskAgentOnly ? (
    <IoWarning size={20} color="orange" />
  ) : (
    <IoWarningOutline size={20} />
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            onClick={() =>
              currentStep !== STEPS.SELECT_ISSUES &&
              toggleFilter("showAskAgentOnly")
            }
            className={`cursor-pointer bg-none ${currentStep === STEPS.SELECT_ISSUES ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {CurrentIcon}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{currentTitle}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
