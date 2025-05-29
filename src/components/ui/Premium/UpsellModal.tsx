import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { GA_UPGRADE_BUTTON_LOCATIONS } from '@/utils/GoogleAnalytics/googleAnalyticsConsts';
import { trackGA4UpgradeButtonClicked } from '@/utils/GoogleAnalytics/googleAnalyticsEvents';
import { navigateToPricingPageWithGaParams } from "@/utils/GoogleAnalytics/googleAnalyticsHelpers";
import React from 'react';

interface UpsellModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSignInClick?: () => void;
    propertyId?: string;
}

export const UpsellModal: React.FC<UpsellModalProps> = ({
    open,
    onOpenChange,
    onSignInClick,
    propertyId
}) => {

    const handleUpgradeClick = async () => {
        trackGA4UpgradeButtonClicked({
            button_location: GA_UPGRADE_BUTTON_LOCATIONS.UPSELL_MODAL_UPGRADE_NOW,
            ...(propertyId && { property_id: propertyId })
        });

        await navigateToPricingPageWithGaParams();
        onOpenChange(false);
    };

    const handleSignInClick = () => {
        if (onSignInClick) {
            onSignInClick();
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="mb-2">Unlock Premium Insights</DialogTitle>
                    <DialogDescription className="text-left">
                        <p>
                            Why waste months and £5,000+ on property buying fees, only to uncover a deal-breaker last minute?
                            <br />
                            <br />
                            Spot them in seconds for less than the cost of a coffee ☕
                        </p>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col gap-2">
                    <Button onClick={handleUpgradeClick}>Upgrade Now</Button>
                    <Button variant="outline" onClick={handleSignInClick}>Sign In</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 