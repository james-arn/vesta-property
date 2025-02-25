import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";

interface BuildingConfirmationDialogProps {
    suggestedBuildingNameOrNumber: string;
    onConfirm: (value: string) => void;
}

export function BuildingConfirmationDialog({
    suggestedBuildingNameOrNumber,
    onConfirm,
}: BuildingConfirmationDialogProps) {
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualValue, setManualValue] = useState(suggestedBuildingNameOrNumber);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">Confirm Building Name/Number</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Please double check the building name / number
                    </DialogTitle>
                    <DialogDescription>
                        From the coordinates the agent provided, we believe it's{" "}
                        {suggestedBuildingNameOrNumber} – is this correct? You can confirm via the exterior
                        image and street map. This is so we can deep search the property correctly.
                    </DialogDescription>
                </DialogHeader>
                {!showManualInput ? (
                    <DialogFooter>
                        <Button onClick={() => onConfirm(suggestedBuildingNameOrNumber)}>Yes</Button>
                        <Button variant="destructive" onClick={() => setShowManualInput(true)}>
                            No
                        </Button>
                    </DialogFooter>
                ) : (
                    <div className="space-y-2">
                        <p>Please provide the correct building name/number:</p>
                        <Input
                            value={manualValue}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualValue(e.target.value)}
                            placeholder="Building name/number"
                        />
                        <DialogFooter>
                            <Button onClick={() => onConfirm(manualValue)}>Submit</Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
