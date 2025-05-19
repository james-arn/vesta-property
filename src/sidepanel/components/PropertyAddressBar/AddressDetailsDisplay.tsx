import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"; // Assuming tooltip is available
import { Confidence, ConfidenceLevels, EpcDataSourceType } from '@/types/property';
import React from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaPencilAlt } from 'react-icons/fa';
import CopyToClipboardButton from "../CopyToClipboardButton"; // Import the new component
import { getHighConfidenceAddressTooltipText, getMediumConfidenceAddressTooltipUpdate } from "./propertyAddressHelpers";

interface AddressDetailsDisplayProps {
    displayAddress: string;
    confidence: Confidence;
    epcSource?: EpcDataSourceType | null;
    onOpenAddressConfirmation?: () => void;
}

const HIGH_CONFIDENCE_LEVELS: Confidence[] = [ConfidenceLevels.HIGH, ConfidenceLevels.USER_PROVIDED, ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED];

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
        confidenceTooltipText = getHighConfidenceAddressTooltipText(confidence, epcSource);
    } else if (showWarningIcon) {
        ConfidenceInfoIcon = FaExclamationTriangle;

        if (confidence === ConfidenceLevels.MEDIUM) {
            confidenceTooltipText = "Address confidence is medium.\nPlease review for accuracy.";
            confidenceTooltipText += getMediumConfidenceAddressTooltipUpdate(epcSource);
        } else { // Handles ConfidenceLevels.NONE and any other non-high, non-medium confidence levels
            confidenceTooltipText = "Address confidence is undetermined or low.\nPlease specify or verify.";
        }
    }

    return (
        <div className="flex items-center justify-between py-1 w-full">
            <span className="font-semibold truncate mr-2 flex-grow min-w-0 text-xs">{displayAddress}</span>
            <div className="flex items-center shrink-0">
                <CopyToClipboardButton
                    textToCopy={displayAddress}
                    ariaLabel="Copy Address to clipboard"
                    tooltipText="Copy address to clipboard"
                    buttonClassName="rounded hover:bg-muted mr-1.5"
                />
                {ConfidenceInfoIcon && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <ConfidenceInfoIcon
                                className={`h-4 w-4 mr-1.5 ${isHighConfidence ? 'text-green-500' : 'text-yellow-500'
                                    }`}
                            />
                        </TooltipTrigger>
                        <TooltipContent
                            side="top"
                            className="max-w-[12rem] break-words">
                            {confidenceTooltipText}
                        </TooltipContent>
                    </Tooltip>
                )}
                {onOpenAddressConfirmation && (
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
                )}
            </div>
        </div>
    );
};

export default AddressDetailsDisplay; 