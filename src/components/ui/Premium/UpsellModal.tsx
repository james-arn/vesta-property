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
}

export const UpsellModal: React.FC<UpsellModalProps> = ({ open, onOpenChange }) => {

    const handleUpgradeClick = () => {
        // Open the pricing page in a new tab
        chrome.tabs.create({ url: ENV_CONFIG.AUTH_PRICING_URL });
        onOpenChange(false); // Close the modal
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Unlock Premium Insights</DialogTitle>
                    <DialogDescription>
                        Upgrade your account to access enhanced property data, including:
                        {/* TODO: Add specific premium feature list based on context */}
                        <ul>
                            <li>- Detailed Planning Permissions</li>
                            <li>- Advanced Local Crime Data</li>
                            <li>- Comprehensive Flood Risk Assessment</li>
                            {/* Add more features as applicable */}
                        </ul>
                        Click 'Upgrade Now' to view plans and unlock these features.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Maybe Later</Button>
                    <Button onClick={handleUpgradeClick}>Upgrade Now</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 