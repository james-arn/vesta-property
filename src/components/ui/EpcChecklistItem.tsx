import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { ConfidenceLevels } from "@/types/property";
import React from 'react';
import { FaExclamationTriangle, FaThumbsUp, FaUserEdit } from "react-icons/fa"; // Assuming these might be needed for confidence icons or future expansion

const EPC_RATINGS = ["A", "B", "C", "D", "E", "F", "G"];

// Confidence Icons (Copied from ChecklistItem initially, can be moved to a shared location later if needed)
const confidenceIcons: Record<(typeof ConfidenceLevels)[keyof typeof ConfidenceLevels], React.ElementType | null> = {
    [ConfidenceLevels.HIGH]: FaThumbsUp,
    [ConfidenceLevels.MEDIUM]: FaExclamationTriangle,
    [ConfidenceLevels.USER_PROVIDED]: FaUserEdit,
    [ConfidenceLevels.NONE]: null,
};

interface EpcChecklistItemProps {
    epcData: EpcProcessorResult | null | undefined;
    onEpcChange?: (newValue: string) => void;
    fallbackValue: React.ReactNode; // The original value passed to ChecklistItem
    isImageSourceWithUrl: boolean;
}

export const EpcChecklistItem: React.FC<EpcChecklistItemProps> = ({
    epcData,
    onEpcChange,
    fallbackValue,
    isImageSourceWithUrl
}) => {

    const renderConfidenceIcon = () => {
        if (!epcData || !epcData.confidence || epcData.confidence === ConfidenceLevels.NONE) {
            return null;
        }
        const ConfidenceIcon = confidenceIcons[epcData.confidence];
        let iconColor = 'text-gray-400'; // Default
        if (epcData.confidence === ConfidenceLevels.HIGH) iconColor = 'text-green-500';
        if (epcData.confidence === ConfidenceLevels.MEDIUM) iconColor = 'text-yellow-500';
        if (epcData.confidence === ConfidenceLevels.USER_PROVIDED) iconColor = 'text-blue-500';

        const tooltipText = `Confidence: ${epcData.confidence}${(epcData.confidence !== ConfidenceLevels.HIGH &&
            epcData.confidence !== ConfidenceLevels.USER_PROVIDED &&
            isImageSourceWithUrl)
            ? '. Please double check against the EPC image and correct if necessary'
            : ''
            }`;

        return ConfidenceIcon ? (
            <TooltipProvider>
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        {/* Added span for Tooltip trigger */}
                        <span className={`ml-2 w-3 h-3 ${iconColor} inline-block`}>
                            <ConfidenceIcon className="w-full h-full" />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" className="max-w-xs">
                        {tooltipText}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        ) : null;
    };


    const canEditEpc = onEpcChange && epcData &&
        epcData.confidence !== ConfidenceLevels.HIGH &&
        epcData.confidence !== ConfidenceLevels.USER_PROVIDED;

    const potentialValue = epcData?.value ?? fallbackValue;
    const isValidEpcString = typeof potentialValue === 'string' && EPC_RATINGS.includes(potentialValue);
    const epcValueToDisplay = isValidEpcString ? potentialValue : "";

    if (canEditEpc && !epcData.isLoading) {
        return (
            <div className="flex items-center">
                <Select onValueChange={onEpcChange} value={epcValueToDisplay}>
                    <SelectTrigger className="h-7 text-xs px-2 w-[60px]">
                        <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                        {EPC_RATINGS.map(rating => (
                            <SelectItem key={rating} value={rating} className="text-xs">
                                {rating}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {renderConfidenceIcon()}
            </div>
        );
    }

    // Otherwise, render non-editable EPC display
    return (
        <span
            className={`flex items-center`}
            style={{ display: 'inline-flex' }} // Ensure icon stays inline
        >
            {epcValueToDisplay}
            {renderConfidenceIcon()}
        </span>
    );
}; 