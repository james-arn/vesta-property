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
  const isDisabled = currentStep !== STEPS.INITIAL_REVIEW;

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
            aria-disabled={isDisabled}
            onClick={() =>
              !isDisabled
              && toggleFilter("showAskAgentOnly")
            }
            className={`bg-none ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer "}`}
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
