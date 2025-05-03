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
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatUnixTimestampToDateString } from "@/utils/dates";
import React from "react";
import { FiLogIn, FiLogOut } from "react-icons/fi";
import { GoCreditCard } from "react-icons/go";
import { IoSettingsOutline } from "react-icons/io5";
import { MdManageAccounts } from "react-icons/md";
import { RiCoinLine } from "react-icons/ri";
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

const SettingsControls = () => {
    const { toast } = useToast();
    const { createPortalSession, isLoading: isPortalLoading } = useCreateStripePortalSession();
    const { userProfile, isLoadingUserProfile } = useUserProfile();

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
        await createPortalSession();
    };

    const isLoading = isAuthenticating || isCheckingAuth || isPortalLoading || (isAuthenticated && isLoadingUserProfile);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center">
                <div className="animate-spin h-5 w-5 border-2 border-primary rounded-full border-t-transparent" />
            </div>
        );
    }

    const tokensRemaining = userProfile?.subscription?.tokens?.remaining;
    const tokenRefreshTimestamp = userProfile?.subscription?.currentPeriodEnd ? parseInt(userProfile.subscription.currentPeriodEnd, 10) : null;

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
                                {typeof tokensRemaining === 'number' && (
                                    <DropdownMenuItem disabled className="opacity-100 flex items-start">
                                        <RiCoinLine className="mr-2 mt-1 flex-shrink-0" />
                                        <div className="flex flex-col">
                                            <span>Tokens: {tokensRemaining}</span>
                                            <span>Refreshing: {formatUnixTimestampToDateString(tokenRefreshTimestamp)}</span>
                                        </div>
                                    </DropdownMenuItem>
                                )}
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
        </>
    );
};

export default SettingsControls;