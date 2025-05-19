import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import React, { useEffect, useState } from 'react';
import { FaCopy } from 'react-icons/fa';

interface CopyToClipboardButtonProps {
    textToCopy: string;
    ariaLabel?: string;
    tooltipText?: string;
    buttonClassName?: string;
    iconClassName?: string;
}

const DEFAULT_ARIA_LABEL = "Copy to clipboard";
const DEFAULT_TOOLTIP_TEXT = "Copy to clipboard";

const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({
    textToCopy,
    ariaLabel = DEFAULT_ARIA_LABEL,
    tooltipText = DEFAULT_TOOLTIP_TEXT,
    buttonClassName = "p-0.5 rounded hover:bg-muted",
    iconClassName = "h-3.5 w-3.5 text-muted-foreground",
}) => {
    const [currentTooltipText, setCurrentTooltipText] = useState(tooltipText);
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);

    useEffect(() => {
        setCurrentTooltipText(tooltipText);
    }, [tooltipText]);

    const handleCopyToClipboard = () => {
        setIsTooltipOpen(false);
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCurrentTooltipText("Copied!");
            setIsTooltipOpen(true);
            setTimeout(() => {
                setCurrentTooltipText(tooltipText);
            }, 1500);
        })
    };

    return (
        <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
            <TooltipTrigger asChild>
                <button
                    onClick={handleCopyToClipboard}
                    className={buttonClassName}
                    aria-label={ariaLabel}
                >
                    <FaCopy className={iconClassName} />
                </button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{currentTooltipText}</p>
            </TooltipContent>
        </Tooltip>
    );
};

export default CopyToClipboardButton; 