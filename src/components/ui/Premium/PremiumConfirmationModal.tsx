import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import React from 'react';

interface PremiumConfirmationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isAddressConfirmed: boolean;
    onConfirmPremiumSearch: () => void;
    // TODO: Add props for remaining tokens if available
    // tokensRemaining?: number;
}

export const PremiumConfirmationModal: React.FC<PremiumConfirmationModalProps> = ({
    open,
    onOpenChange,
    isAddressConfirmed,
    onConfirmPremiumSearch,
    // tokensRemaining,
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Confirm Premium Search</DialogTitle>
                    <DialogDescription>
                        Using Premium Search consumes one token. This will unlock enhanced data for this property.
                        {/* {typeof tokensRemaining === 'number' && 
              ` You currently have ${tokensRemaining} token(s) remaining.`
            } */}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onConfirmPremiumSearch}>Confirm & Use Token</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 