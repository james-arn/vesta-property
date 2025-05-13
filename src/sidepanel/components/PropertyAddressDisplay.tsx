import { confidenceIcons } from '@/constants/uiConstants'; // Import from shared location
import { GovEpcValidationMatch } from '@/types/govEpcCertificate';
import { Address, ConfidenceLevels } from '@/types/property';
import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa'; // Keep this if only used for the disclaimer icon

interface PropertyAddressDisplayProps {
    address: Address | null;
    reverseGeocodedAddress?: string | null;
    onOpenAddressConfirmation?: () => void;
    onSelectGovEpcSuggestion?: (suggestion: GovEpcValidationMatch) => void;
}

const DISCLAIMER_TEXT = "Exact address based on agent's geolocation coordinates.";
const EPC_SEARCH_BASE_URL = "https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=";

const PropertyAddressDisplay: React.FC<PropertyAddressDisplayProps> = ({
    address,
    reverseGeocodedAddress,
    onOpenAddressConfirmation,
    onSelectGovEpcSuggestion,
}) => {
    if (!address || !address.displayAddress) {
        return null; // Don't render if no address
    }

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

    return (
        <div className="p-2 border-b bg-background text-foreground text-sm">
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
            {/* Section for GOV EPC Register Suggestions */}
            {address.govEpcRegisterSuggestions && address.govEpcRegisterSuggestions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">Address suggestions from GOV EPC Register:</h4>
                    <ul className="list-none p-0 m-0">
                        {address.govEpcRegisterSuggestions.map((suggestion, index) => (
                            <li key={index} className="text-xs text-muted-foreground py-1 flex justify-between items-center">
                                <span className="mr-2">{suggestion.retrievedAddress}</span>
                                {onSelectGovEpcSuggestion && (
                                    <button
                                        onClick={() => onSelectGovEpcSuggestion(suggestion)}
                                        className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-2 py-0.5 rounded-sm shrink-0"
                                        aria-label={`Use address: ${suggestion.retrievedAddress}`}
                                    >
                                        Use this address
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default PropertyAddressDisplay; 