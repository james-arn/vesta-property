import { GovEpcValidationMatch } from '@/types/govEpcCertificate';
import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

interface PropertyAddressDisplayAccordionContentProps {
    matchingSuggestions: GovEpcValidationMatch[];
    onSelectGovEpcSuggestion?: (suggestion: GovEpcValidationMatch) => void;
    postcode?: string | null;
    reverseGeocodedAddress?: string | null;
    onOpenAddressConfirmation?: () => void;
}

const DISCLAIMER_TEXT = "Exact address based on agent's geolocation coordinates.";
const EPC_SEARCH_BASE_URL = "https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=";

const PropertyAddressDisplayAccordionContent: React.FC<PropertyAddressDisplayAccordionContentProps> = ({
    matchingSuggestions,
    onSelectGovEpcSuggestion,
    postcode,
    reverseGeocodedAddress,
    onOpenAddressConfirmation,
}) => {
    return (
        <>
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

            {postcode && (
                <div className="text-xs text-muted-foreground my-2 pt-2 border-t border-border">
                    <a
                        href={`${EPC_SEARCH_BASE_URL}${postcode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                    >
                        Search all EPCs for postcode: {postcode}
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
        </>
    );
};

export default PropertyAddressDisplayAccordionContent; 