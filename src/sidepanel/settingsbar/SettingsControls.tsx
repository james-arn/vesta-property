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
import { ENV_CONFIG } from "@/constants/environmentConfig";
import { useToast } from "@/hooks/use-toast";
import useCreateStripePortalSession from "@/hooks/useCreateStripePortalSession";
import { useSecureAuthentication } from "@/hooks/useSecureAuthentication";
import React from "react";
import { FiLogIn, FiLogOut } from "react-icons/fi";
import { GoCreditCard, GoStar } from "react-icons/go";
import { IoSettingsOutline } from "react-icons/io5";
import { MdManageAccounts } from "react-icons/md";
import { VscFeedback } from "react-icons/vsc";

const SettingsIcon = () => (
    <TooltipProvider>
        <div className="relative">
            <div className="cursor-pointer" data-tooltip="Settings">
                <IoSettingsOutline size={20} />
            </div>
        </div>
    </TooltipProvider>
);

// Premium upgrade footer component
const PremiumFooterCTA = ({ onClick }: { onClick: () => void }) => (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-amber-400 to-amber-600 text-white p-3 shadow-md flex items-center justify-center cursor-pointer z-10" onClick={onClick}>
        <GoStar className="mr-2 text-amber-100" size={18} />
        <span className="font-medium">Upgrade to Premium</span>
    </div>
);

const SettingsControls = () => {
    const { toast } = useToast();
    const { createPortalSession, isLoading: isPortalLoading } = useCreateStripePortalSession();

    const {
        isAuthenticated,
        isCheckingAuth,
        isSigningIn: isAuthenticating,
        signInRedirect,
        signOut
    } = useSecureAuthentication();

    // Handle feedback function
    const handleFeedback = () => {
        toast({
            description: <Feedback />,
            variant: "default",
            duration: 12000000, // 20 minutes
        });
    };

    const handleUpgrade = () => {
        chrome.tabs.create({ url: ENV_CONFIG.AUTH_PRICING_URL });
    };

    const handleManageSubscription = async () => {
        // The hook handles error display and tab opening internally
        await createPortalSession(window.location.href);
    };

    if (isAuthenticating || isCheckingAuth || isPortalLoading) {
        return (
            <div className="flex items-center justify-center">
                <div className="animate-spin h-5 w-5 border-2 border-primary rounded-full border-t-transparent" />
            </div>
        );
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div className="group">
                        <SettingsIcon />
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Settings</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        {isAuthenticated ? (
                            <>
                                <DropdownMenuItem onClick={handleManageSubscription} className="cursor-pointer">
                                    <MdManageAccounts className="mr-2" />
                                    <span>Manage Subscription</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                                    <FiLogOut className="mr-2" />
                                    <span>Sign out</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        ) : (
                            <>
                                <DropdownMenuItem onClick={signInRedirect} className="cursor-pointer">
                                    <FiLogIn className="mr-2" />
                                    <span>Sign in</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleUpgrade} className="cursor-pointer text-primary font-semibold">
                                    <GoCreditCard className="mr-2" />
                                    <span>Upgrade</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuItem onClick={handleFeedback} className="cursor-pointer">
                            <VscFeedback className="mr-2" />
                            <span>Give feedback</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                            <span>More features coming soon! 😊</span>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Only show premium footer CTA when not authenticated */}
            {!isAuthenticated && <PremiumFooterCTA onClick={handleUpgrade} />}
        </>
    );
};

export default SettingsControls;