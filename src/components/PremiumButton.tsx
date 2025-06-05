import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import React, { ReactNode } from "react";

interface PremiumButtonProps {
    icon: ReactNode;
    text: string;
    tooltipText?: string;
    onClick: () => void;
}

const getButtonContent = (icon: ReactNode, text: string) => (
    <>
        <div className="flex items-center gap-2 z-10">
            {icon}
            <span className="font-semibold tracking-wide">{text}</span>
        </div>
        <div className="absolute inset-0 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-[#FFD700]/20 to-transparent -translate-x-full animate-shimmer"></div>
        </div>
    </>
);

export const PremiumButton = ({
    icon,
    text,
    tooltipText,
    onClick,
}: PremiumButtonProps): React.JSX.Element => {
    const button = (
        <Button
            size="default"
            variant="default"
            onClick={onClick}
            className="relative flex items-center gap-2 bg-gradient-to-r from-[#B8860B] via-[#DAA520] to-[#B8860B] hover:from-[#986C08] hover:via-[#B8860B] hover:to-[#986C08] transition-all duration-300 border border-[#FFD700]/30 shadow-[0_2px_10px_rgba(255,215,0,0.15)] text-white font-medium py-2 px-4"
        >
            {getButtonContent(icon, text)}
        </Button>
    );

    if (!tooltipText) {
        return button;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    {button}
                </TooltipTrigger>
                <TooltipContent sideOffset={5} className="bg-slate-900 text-white">
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};