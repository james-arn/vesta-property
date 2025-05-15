import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Assuming tooltip is available
import { Confidence, ConfidenceLevels, EpcDataSourceType } from '@/types/property';
import React from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaPencilAlt } from 'react-icons/fa';

interface AddressDetailsDisplayProps {
    displayAddress: string;
    confidence: Confidence;
    epcSource?: EpcDataSourceType | null;
    onOpenAddressConfirmation?: () => void;
}

const HIGH_CONFIDENCE_LEVELS: Confidence[] = [ConfidenceLevels.HIGH, ConfidenceLevels.USER_PROVIDED, ConfidenceLevels.CONFIRMED_BY_GOV_EPC];

const getHighConfidenceTooltipText = (confidence: Confidence, epcSource?: EpcDataSourceType | null): string => {
    switch (confidence) {
        case ConfidenceLevels.CONFIRMED_BY_GOV_EPC:
            return "Address confirmed via unique GOV EPC register match.";
        case ConfidenceLevels.HIGH:
            if (epcSource === EpcDataSourceType.GOV_EPC_AND_FILE_EPC_MATCH) {
                return "Address auto-confirmed: unique GOV EPC suggestion matched file EPC.";
            }
            return "Address confidence is high based on available data.";
        case ConfidenceLevels.USER_PROVIDED:
            return "Address provided by user.";
        default:
            return "Address confidence: High";
    }
};

const AddressDetailsDisplay: React.FC<AddressDetailsDisplayProps> = ({
    displayAddress,
    confidence,
    epcSource,
    onOpenAddressConfirmation,
}) => {
    const isHighConfidence = HIGH_CONFIDENCE_LEVELS.includes(confidence);
    const showWarningIcon = !isHighConfidence;

    let ConfidenceInfoIcon = null;
    let confidenceTooltipText = "";

    if (isHighConfidence) {
        ConfidenceInfoIcon = FaCheckCircle;
        confidenceTooltipText = getHighConfidenceTooltipText(confidence, epcSource);
    } else if (showWarningIcon) {
        ConfidenceInfoIcon = FaExclamationTriangle;
        confidenceTooltipText = `Address confidence: ${confidence || 'None'}. Review recommended.`;
        if (confidence === ConfidenceLevels.MEDIUM && epcSource) {
            confidenceTooltipText += ` Source: ${epcSource}.`;
        }
    }

    return (
        <div className="flex items-center justify-between py-1 w-full">
            <span className="font-semibold truncate mr-2 flex-grow min-w-0">{displayAddress}</span>
            <div className="flex items-center shrink-0">
                {ConfidenceInfoIcon && (
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <ConfidenceInfoIcon
                                    className={`h-4 w-4 mr-2 ${isHighConfidence ? 'text-green-500' : 'text-yellow-500'
                                        }`}
                                />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{confidenceTooltipText}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {onOpenAddressConfirmation && (
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={onOpenAddressConfirmation}
                                    className="p-0.5 rounded hover:bg-muted"
                                    aria-label="Edit Address"
                                >
                                    <FaPencilAlt className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Edit Address</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );
};

export default AddressDetailsDisplay; 