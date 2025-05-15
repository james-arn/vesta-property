import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
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
import { DISCLAIMER_TEXT, EPC_SEARCH_BASE_URL } from "@/constants/uiConstants";
import { parseDisplayAddress } from "@/lib/address";
import { GovEpcValidationMatch } from "@/types/govEpcCertificate";
import { Address, ConfidenceLevels, EpcDataSourceType } from "@/types/property";
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
    epcSource?: EpcDataSourceType | null;
    onSelectGovEpcSuggestion?: (suggestion: GovEpcValidationMatch) => void;
}

export function BuildingConfirmationDialog({
    open,
    onOpenChange,
    addressData,
    handleConfirm,
    reverseGeocodedAddress,
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

    const matchingSuggestions = useMemo(() => {
        return addressData?.govEpcRegisterSuggestions?.filter(
            (suggestion) => suggestion.matchesFileEpcRating
        ) || [];
    }, [addressData?.govEpcRegisterSuggestions]);

    const [showHelpSection, setShowHelpSection] = useState(false);
    const shouldOfferHelp = addressData?.addressConfidence !== ConfidenceLevels.HIGH && addressData?.addressConfidence !== ConfidenceLevels.CONFIRMED_BY_GOV_EPC;

    // Reset showHelpSection when dialog is closed or addressData changes
    useEffect(() => {
        if (!open) {
            setShowHelpSection(false);
        }
    }, [open]);

    useEffect(() => {
        setShowHelpSection(false); // Reset if address data changes, implying a new context
    }, [addressData]);

    const matchingEPC = matchingSuggestions[0].retrievedRating;

    return (
        <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">
                        Confirm Full Address
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Please carefully check and correct the address details below. An accurate address is crucial.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {/* Combined Building/Street Row */}
                    <div className="flex space-x-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                            <Label htmlFor="building" className="text-xs font-medium">Building Number / Name</Label>
                            <Input id="building" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="3 or The Willows" className="text-sm w-full" />
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                            <Label htmlFor="street" className="text-xs font-medium">Street</Label>
                            <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="e.g., Downing Street" className="text-sm w-full" required />
                        </div>
                    </div>
                    {/* Combined Town/Postcode Row */}
                    <div className="flex space-x-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                            <Label htmlFor="town" className="text-xs font-medium">Town / City</Label>
                            <Input id="town" value={town} onChange={(e) => setTown(e.target.value)} placeholder="e.g., London" className="text-sm w-full" required />
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                            <Label htmlFor="postcode" className="text-xs font-medium">Postcode</Label>
                            <Input id="postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="e.g., SW1A 2AA" className="text-sm w-full" required />
                        </div>
                    </div>
                </div>

                {/* Help Section Trigger & Content */}
                {shouldOfferHelp && (
                    <div>
                        {!showHelpSection && (
                            <Button
                                variant="link"
                                className="text-xs p-0 h-auto text-muted-foreground hover:text-primary"
                                onClick={() => setShowHelpSection(true)}
                            >
                                Unsure? Get help & address suggestions...
                            </Button>
                        )}
                        {showHelpSection && (
                            <Accordion type="single" collapsible className="w-full" defaultValue="address-guidance"> {/* Open by default when shown */}
                                <AccordionItem value="address-guidance" className="border-b-0"> {/* Remove border from AccordionItem if it's the only one */}
                                    <AccordionTrigger
                                        className="text-xs p-0 h-auto text-muted-foreground hover:text-primary"
                                        onClick={() => setShowHelpSection(!showHelpSection)}
                                    >
                                        Address Guidance & Suggestions (click to hide)
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-3 pb-2 text-xs max-h-[280px] overflow-y-auto space-y-1">
                                        <ol className="list-decimal list-outside ml-4 space-y-4">
                                            {/* 1. Potential Matches from GOV EPC - Conditionally rendered LI */}
                                            {matchingSuggestions.length > 0 && (() => {
                                                const matchingEPCDisplay = matchingSuggestions[0]?.retrievedRating ? `(${matchingSuggestions[0].retrievedRating})` : '';
                                                return (
                                                    <li className="space-y-1">
                                                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">Potential Matches from GOV EPC {matchingEPCDisplay}:</h4>
                                                        <ul className="list-disc space-y-0.5">
                                                            {matchingSuggestions.map((suggestion, index) => (
                                                                <li key={index} className="py-0.5">
                                                                    <span className="text-muted-foreground">
                                                                        {suggestion.retrievedAddress}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        {addressData?.postcode && (
                                                            <p className="mt-2 text-muted-foreground">
                                                                <a href={`${EPC_SEARCH_BASE_URL}${addressData.postcode}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                                                                    Search all EPCs for postcode: {addressData.postcode}
                                                                </a>
                                                            </p>
                                                        )}
                                                    </li>
                                                );
                                            })()}
                                            {/* 2. Agent Pin Location - Conditionally rendered LI */}
                                            {reverseGeocodedAddress && (
                                                <li className="space-y-0.5">
                                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Agent's Location Pin:</h4>
                                                    <div className="text-muted-foreground pl-2">
                                                        {reverseGeocodedAddress} ({DISCLAIMER_TEXT}).
                                                        <span className="block mt-0.5"><span className="font-semibold">Verify carefully:</span> agent pins can be approximate.</span>
                                                    </div>
                                                </li>
                                            )}

                                            {/* 3. Other Tips & Resources - LI will always render if shouldOfferHelp is true and this block is reached */}
                                            <li className="space-y-1">
                                                <h4 className="font-semibold text-gray-800 dark:text-gray-200">Other Tips & Resources:</h4>
                                                <div className="pl-2 space-y-1 text-muted-foreground">
                                                    <p>
                                                        Consider using online map services with street view or checking listing images for visual cues (e.g., house numbers on bins, door plaques, unique property features).
                                                    </p>
                                                </div>
                                            </li>
                                        </ol>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                    </div>
                )}

                <DialogFooter className="flex flex-column gap-2">
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
