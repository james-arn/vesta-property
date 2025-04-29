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
import { Label } from "@/components/ui/label";
import { parseDisplayAddress } from "@/lib/address";
import { Address } from "@/types/property";
import React, { useEffect, useMemo, useState } from "react";

interface BuildingConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    addressData: Address | null;
    handleConfirm: (
        confirmedAddress: Pick<
            Address,
            "confirmedBuilding" | "confirmedStreet" | "confirmedTown" | "confirmedPostcode"
        >
    ) => void;
    reverseGeocodedAddress?: string | null;
}

export function BuildingConfirmationDialog({
    open,
    onOpenChange,
    addressData,
    handleConfirm,
    reverseGeocodedAddress
}: BuildingConfirmationDialogProps) {
    const initialParsedAddress = useMemo(
        () => parseDisplayAddress(addressData?.displayAddress ?? null, addressData?.postcode ?? null),
        [addressData]
    );

    const [building, setBuilding] = useState(initialParsedAddress.buildingGuess);
    const [street, setStreet] = useState(initialParsedAddress.streetGuess);
    const [town, setTown] = useState(initialParsedAddress.townGuess);
    const [postcode, setPostcode] = useState(initialParsedAddress.postcodeGuess);

    useEffect(() => {
        const parsed = parseDisplayAddress(
            addressData?.displayAddress ?? null,
            addressData?.postcode ?? null
        );
        setBuilding(parsed.buildingGuess);
        setStreet(parsed.streetGuess);
        setTown(parsed.townGuess);
        setPostcode(parsed.postcodeGuess);
    }, [addressData]);

    const isFormValid = street.trim() && town.trim() && postcode.trim();

    const onConfirmClick = () => {
        if (!isFormValid) return;

        handleConfirm({
            confirmedBuilding: building.trim(),
            confirmedStreet: street.trim(),
            confirmedTown: town.trim(),
            confirmedPostcode: postcode.trim(),
        });
        onOpenChange(false);
    };

    const handleDialogClose = (newOpenState: boolean) => {
        if (!newOpenState) {
            const parsed = parseDisplayAddress(
                addressData?.displayAddress ?? null,
                addressData?.postcode ?? null
            );
            setBuilding(parsed.buildingGuess);
            setStreet(parsed.streetGuess);
            setTown(parsed.townGuess);
            setPostcode(parsed.postcodeGuess);
        }
        onOpenChange(newOpenState);
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">
                        Confirm Full Address for Premium Search
                    </DialogTitle>
                    <DialogDescription>
                        <p className="text-xs mb-1">
                            Please carefully check and correct the address details below (pre-filled from the listing). An accurate address is crucial for the premium data search.
                        </p>
                        {reverseGeocodedAddress && (
                            <p className="text-xs text-muted-foreground italic">
                                (Agent coordinates suggested: {reverseGeocodedAddress})
                            </p>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="building" className="text-xs font-medium">Building Name / Number</Label>
                        <Input
                            id="building"
                            value={building}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setBuilding(e.target.value)
                            }
                            placeholder="e.g., 12 or The Willows"
                            className="text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="street" className="text-xs font-medium">Street</Label>
                        <Input
                            id="street"
                            value={street}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setStreet(e.target.value)
                            }
                            placeholder="e.g., Downing Street"
                            className="text-sm"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="town" className="text-xs font-medium">Town / City</Label>
                        <Input
                            id="town"
                            value={town}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setTown(e.target.value)
                            }
                            placeholder="e.g., London"
                            className="text-sm"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="postcode" className="text-xs font-medium">Postcode</Label>
                        <Input
                            id="postcode"
                            value={postcode}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setPostcode(e.target.value)
                            }
                            placeholder="e.g., SW1A 2AA"
                            className="text-sm"
                            required
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => handleDialogClose(false)}>Cancel</Button>
                    <Button onClick={onConfirmClick} disabled={!isFormValid}>
                        Confirm Address & Proceed
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default BuildingConfirmationDialog;
