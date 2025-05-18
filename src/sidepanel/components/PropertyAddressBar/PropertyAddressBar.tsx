import { GovEpcValidationMatch } from '@/types/govEpcCertificate';
import { Address, Confidence, ConfidenceLevels, EpcDataSourceType } from '@/types/property';
import React from 'react';
import AddressDetailsDisplay from './AddressDetailsDisplay';

interface PropertyAddressDisplayProps {
    address: Address | null;
    epcSource?: EpcDataSourceType | null;
    reverseGeocodedAddress?: string | null;
    onOpenAddressConfirmation?: () => void;
    onSelectGovEpcSuggestion?: (suggestion: GovEpcValidationMatch) => void;
}

const PropertyAddressBar: React.FC<PropertyAddressDisplayProps> = ({
    address,
    epcSource,
    onOpenAddressConfirmation,
}) => {
    if (!address || !address.displayAddress) {
        return null;
    }

    const confidence: Confidence = address.addressConfidence || ConfidenceLevels.NONE;

    const isSingleAutoConfirmedGovMatch =
        (confidence === ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED ||
            (confidence === ConfidenceLevels.HIGH && epcSource === EpcDataSourceType.GOV_EPC_SERVICE_AND_OCR_FILE_EPC_MATCH)
        ) &&
        address.govEpcRegisterSuggestions && address.govEpcRegisterSuggestions.length === 1 &&
        address.govEpcRegisterSuggestions[0].retrievedAddress === address.displayAddress;

    return (
        <div className="py-2 px-4 border-b bg-background text-foreground text-sm">
            <AddressDetailsDisplay
                displayAddress={address.displayAddress}
                confidence={confidence}
                epcSource={epcSource}
                onOpenAddressConfirmation={onOpenAddressConfirmation}
            />
            {isSingleAutoConfirmedGovMatch && (
                <div className="mt-1 pt-1 border-t border-border">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-0.5">
                        Confirmed GOV EPC Address Match:
                    </h4>
                    <ul className="list-none p-0 m-0">
                        {address.govEpcRegisterSuggestions?.map((suggestion, index) => (
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
        </div>
    );
};

export default PropertyAddressBar; 