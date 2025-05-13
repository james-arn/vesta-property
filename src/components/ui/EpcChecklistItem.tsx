import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { confidenceIcons } from "@/constants/uiConstants";
import { Confidence, ConfidenceLevels } from "@/types/property";
import React from 'react';

const EPC_RATINGS = ["A", "B", "C", "D", "E", "F", "G"];


interface EpcChecklistItemProps {
    value: string | null | undefined;
    confidence: Confidence | null | undefined;
    onEpcChange?: (newValue: string) => void;
    isImageSourceWithUrl: boolean;
}

export const EpcChecklistItem: React.FC<EpcChecklistItemProps> = ({
    value,
    confidence,
    onEpcChange,
    isImageSourceWithUrl
}) => {

    const renderConfidenceIcon = () => {
        if (!confidence || confidence === ConfidenceLevels.NONE) {
            return null;
        }
        const ConfidenceIcon = confidenceIcons[confidence];
        let iconColor = 'text-gray-400';
        if (confidence === ConfidenceLevels.HIGH || confidence === ConfidenceLevels.CONFIRMED_BY_GOV_EPC) iconColor = 'text-green-500';
        if (confidence === ConfidenceLevels.MEDIUM) iconColor = 'text-yellow-500';
        if (confidence === ConfidenceLevels.USER_PROVIDED) iconColor = 'text-blue-500';

        const tooltipText = `Confidence: ${confidence}${(confidence !== ConfidenceLevels.HIGH &&
            confidence !== ConfidenceLevels.USER_PROVIDED &&
            isImageSourceWithUrl)
            ? '. Please double check against the EPC image and correct if necessary'
            : ''
            }`;

        return ConfidenceIcon ? (
            <TooltipProvider>
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
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


    const canEditEpc = onEpcChange &&
        confidence &&
        confidence !== ConfidenceLevels.HIGH
    const potentialValue = value;
    const isValidEpcString = typeof potentialValue === 'string' && EPC_RATINGS.includes(potentialValue.toUpperCase());
    const epcValueToDisplay = isValidEpcString ? potentialValue.toUpperCase() : "";

    if (canEditEpc) {
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

    return (
        <span
            className={`flex items-center`}
            style={{ display: 'inline-flex' }}
        >
            {epcValueToDisplay}
            {renderConfidenceIcon()}
        </span>
    );
}; 