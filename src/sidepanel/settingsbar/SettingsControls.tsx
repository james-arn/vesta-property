import Feedback from "@/components/Feedback";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import React from "react";
import { IoSettingsOutline } from "react-icons/io5";
import { VscFeedback } from "react-icons/vsc";

const SettingsIconWithTooltip = () => (
    <TooltipProvider>
        <div className="relative">
            <div className="cursor-pointer" data-tooltip="Settings">
                <IoSettingsOutline size={20} />
            </div>
            {/* Custom tooltip used to ensure click event opens dropdown as expected */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-6 hidden group-hover:block pointer-events-none bg-primary text-primary-foreground text-xs rounded px-2 py-1">
                Settings
            </div>
        </div>
    </TooltipProvider>
);

const SettingsControls = () => {
    const { toast } = useToast();

    const handleFeedback = () => {
        toast({
            description: <Feedback />,
            variant: "default",
            duration: 12000000, // 20 minutes
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="group">
                    <SettingsIconWithTooltip />
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={handleFeedback} className="cursor-pointer">
                        <VscFeedback className="mr-2" />
                        <span>Give feedback</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                        <span>More features coming soon! 😊</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu >
    );
};

export default SettingsControls;