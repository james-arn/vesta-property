import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import React, { useEffect, useState } from "react";

interface BuildingConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suggestedBuildingNameOrNumber: string;
    handleConfirm: (value: string) => void;
}

export function BuildingConfirmationDialog({
    open,
    onOpenChange,
    suggestedBuildingNameOrNumber,
    handleConfirm
}: BuildingConfirmationDialogProps) {
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualValue, setManualValue] = useState(suggestedBuildingNameOrNumber);

    useEffect(() => {
        setManualValue(suggestedBuildingNameOrNumber);
    }, [suggestedBuildingNameOrNumber]);

    const onConfirm = (value: string) => {
        handleConfirm(value);
        onOpenChange(false);
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    {!showManualInput ? (
                        <>
                            <DialogTitle className="text-lg font-bold">
                                Is this <span>{suggestedBuildingNameOrNumber}</span>?
                            </DialogTitle>
                            <DialogDescription>
                                <p className="text-xs">
                                    Please check by looking at the property's exterior image (e.g. near the door or bins) and via Street View on the map.
                                </p>
                                <p className="text-xs mt-2">
                                    We obtained this address using the co-ordinates provided by the agent. For an accurate deep search, double-check this detail carefully.
                                </p>
                            </DialogDescription>
                        </>
                    ) : (
                        <DialogTitle className="text-lg font-bold">
                            Enter the correct building name or number
                        </DialogTitle>
                    )}
                </DialogHeader>
                {!showManualInput ? (
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onConfirm(suggestedBuildingNameOrNumber)}>
                            Yes
                        </Button>
                        <Button
                            onClick={() => setShowManualInput(true)}>
                            No
                        </Button>
                    </DialogFooter>
                ) : (
                    <div className="space-y-2">
                        <Input
                            value={manualValue}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualValue(e.target.value)}
                            placeholder="Building name/number"
                            className="text-xs"
                        />
                        <DialogFooter>
                            <Button onClick={() => onConfirm(manualValue)} disabled={!manualValue.trim()}>Submit</Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
