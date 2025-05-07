import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ENV_CONFIG } from '@/constants/environmentConfig';
import React from 'react';

interface UpsellModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSignInClick?: () => void;
}

export const UpsellModal: React.FC<UpsellModalProps> = ({
    open,
    onOpenChange,
    onSignInClick
}) => {

    const handleUpgradeClick = () => {
        // Open the pricing page in a new tab
        chrome.tabs.create({ url: ENV_CONFIG.AUTH_PRICING_URL });
        onOpenChange(false); // Close the modal
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
                    <DialogTitle>Unlock Premium Insights</DialogTitle>
                    <DialogDescription>
                        Upgrade to deep search on listings. Fill in any missing information and harness the power of AI predictions, such as estimated valuations and propensity to sell - proven to be highly accurate and reliable.
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