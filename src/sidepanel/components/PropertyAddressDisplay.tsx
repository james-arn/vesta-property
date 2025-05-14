import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"; // Added Accordion imports
import { confidenceIcons } from '@/constants/uiConstants'; // Import from shared location
import { GovEpcValidationMatch } from '@/types/govEpcCertificate';
import { Address, ConfidenceLevels, EpcDataSourceType } from '@/types/property';
import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa'; // Keep this if only used for the disclaimer icon

interface PropertyAddressDisplayProps {
    address: Address | null;
    epcSource?: EpcDataSourceType | null;
    reverseGeocodedAddress?: string | null;
    onOpenAddressConfirmation?: () => void;
    onSelectGovEpcSuggestion?: (suggestion: GovEpcValidationMatch) => void;
}

const DISCLAIMER_TEXT = "Exact address based on agent's geolocation coordinates.";
const EPC_SEARCH_BASE_URL = "https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=";

const PropertyAddressDisplay: React.FC<PropertyAddressDisplayProps> = ({
    address,
    epcSource,
    reverseGeocodedAddress,
    onOpenAddressConfirmation,
    onSelectGovEpcSuggestion,
}) => {
    if (!address || !address.displayAddress) {
        return null; // Don't render if no address
    }

    // Filter suggestions: only show those matching the file-derived EPC rating.
    const matchingSuggestions = address.govEpcRegisterSuggestions
        ? address.govEpcRegisterSuggestions.filter(suggestion => suggestion.matchesFileEpcRating)
        : [];

    const confidence = address.addressConfidence || ConfidenceLevels.NONE;
    const ConfidenceIcon = confidenceIcons[confidence];
    const showReverseGeocoded = confidence !== ConfidenceLevels.HIGH && confidence !== ConfidenceLevels.CONFIRMED_BY_GOV_EPC && !!reverseGeocodedAddress;
    const showEpcLink = confidence !== ConfidenceLevels.HIGH && confidence !== ConfidenceLevels.CONFIRMED_BY_GOV_EPC && !!address.postcode;
    const canConfirmAddress = confidence !== ConfidenceLevels.HIGH && confidence !== ConfidenceLevels.CONFIRMED_BY_GOV_EPC && !!onOpenAddressConfirmation;

    const AddressInfo = (
        <div className={`flex items-center justify-between ${canConfirmAddress ? 'cursor-pointer hover:opacity-80' : ''}`}>
            <span className="font-semibold truncate mr-2">{address.displayAddress}</span>
            {ConfidenceIcon && (
                <ConfidenceIcon
                    className={`h-4 w-4 shrink-0 ${confidence === ConfidenceLevels.HIGH || confidence === ConfidenceLevels.CONFIRMED_BY_GOV_EPC
                        ? 'text-green-500'
                        : confidence === ConfidenceLevels.MEDIUM
                            ? 'text-yellow-500'
                            : 'text-gray-500'
                        }`}
                    title={`Address Confidence: ${confidence}${canConfirmAddress ? ' (click to confirm)' : ''}`}
                />
            )}
        </div>
    );

    // True if confidence is high AND it was due to the specific auto-confirmation flow (unique GOV match to file EPC)
    // or a direct strong GOV match.
    // The backend now ensures govEpcRegisterSuggestions has only 1 item if auto-confirmed.
    const isSingleAutoConfirmedGovMatch =
        (confidence === ConfidenceLevels.CONFIRMED_BY_GOV_EPC || // Direct GOV strong match
            (confidence === ConfidenceLevels.HIGH && epcSource === EpcDataSourceType.GOV_EPC_AND_FILE_EPC_MATCH) // Our auto-confirmation scenario
        ) &&
        address.govEpcRegisterSuggestions && address.govEpcRegisterSuggestions.length === 1 &&
        address.govEpcRegisterSuggestions[0].retrievedAddress === address.displayAddress;

    return (
        <div className="p-2 border-b bg-background text-foreground text-sm">
            {isSingleAutoConfirmedGovMatch && (
                <div className="mt-1 pt-1 border-t border-border">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-0.5">
                        Confirmed GOV EPC Address Match:
                    </h4>
                    <ul className="list-none p-0 m-0">
                        {address.govEpcRegisterSuggestions!.map((suggestion, index) => (
                            <li key={index} className="text-xs text-muted-foreground py-0.5">
                                <span className="mr-2">
                                    {suggestion.retrievedAddress}
                                    {suggestion.retrievedRating && <span className="ml-1 text-gray-500">({suggestion.retrievedRating})</span>}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {canConfirmAddress ? (
                <button
                    onClick={onOpenAddressConfirmation}
                    className="block w-full text-left p-0 m-0 border-none bg-transparent hover:bg-transparent focus:outline-none"
                    aria-label="Confirm address"
                >
                    {AddressInfo}
                </button>
            ) : (
                AddressInfo
            )}
            {showReverseGeocoded && (
                <div className="text-xs text-muted-foreground mt-1">
                    <FaExclamationTriangle className="inline h-3 w-3 mr-1 text-yellow-500 shrink-0" />
                    <span>Possible Match: {reverseGeocodedAddress} ({DISCLAIMER_TEXT})</span>
                </div>
            )}
            {showEpcLink && (
                <div className="text-xs text-muted-foreground mt-1">
                    <a
                        href={`${EPC_SEARCH_BASE_URL}${address.postcode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                    >
                        Find address by recent EPC ({address.postcode})
                    </a>
                </div>
            )}

            {confidence !== ConfidenceLevels.HIGH && confidence !== ConfidenceLevels.CONFIRMED_BY_GOV_EPC && (
                <Accordion type="single" collapsible className="w-full mt-1">
                    <AccordionItem value="address-confirmation-options" className="border-b-0">
                        <AccordionTrigger className="text-xs hover:no-underline py-1.5 text-muted-foreground justify-start p-1 -mx-1">
                            <FaExclamationTriangle className="inline h-3 w-3 mr-1.5 text-yellow-500 shrink-0" />
                            Review / Confirm Address
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-0">
                            {matchingSuggestions && matchingSuggestions.length > 0 && (
                                <div className="mb-2">
                                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">
                                        {matchingSuggestions.length === 1 ? "Potential Match (matches file EPC):" : "Suggestions from GOV EPC (matching file EPC):"}
                                    </h4>
                                    <ul className="list-none p-0 m-0">
                                        {matchingSuggestions.map((suggestion, index) => (
                                            <li
                                                key={index}
                                                className="text-xs py-1 flex justify-between items-center"
                                            >
                                                <span className="mr-2 text-muted-foreground">
                                                    {suggestion.retrievedAddress}
                                                    {suggestion.retrievedRating && <span className="ml-1 text-gray-400">({suggestion.retrievedRating})</span>}
                                                </span>
                                                {onSelectGovEpcSuggestion && (
                                                    <button
                                                        onClick={() => onSelectGovEpcSuggestion(suggestion)}
                                                        className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-2 py-0.5 rounded-sm shrink-0"
                                                        aria-label={`Use address: ${suggestion.retrievedAddress}`}
                                                    >
                                                        Use
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {address.postcode && (
                                <div className="text-xs text-muted-foreground my-2 pt-2 border-t border-border">
                                    <a
                                        href={`${EPC_SEARCH_BASE_URL}${address.postcode}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                    >
                                        Search all EPCs for postcode: {address.postcode}
                                    </a>
                                </div>
                            )}

                            {reverseGeocodedAddress && (
                                <div className="text-xs text-muted-foreground my-2 pt-2 border-t border-border">
                                    <FaExclamationTriangle className="inline h-3 w-3 mr-1 text-yellow-500 shrink-0" />
                                    <span>Agent Pin Location: {reverseGeocodedAddress} ({DISCLAIMER_TEXT})</span>
                                </div>
                            )}

                            {onOpenAddressConfirmation && (
                                <button
                                    onClick={onOpenAddressConfirmation}
                                    className="text-xs w-full mt-2 text-left text-primary hover:underline p-1 -mx-1 rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                    Enter address manually...
                                </button>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    );
};

export default PropertyAddressDisplay; 