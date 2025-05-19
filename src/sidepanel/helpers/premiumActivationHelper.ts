import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { parseDisplayAddress } from "@/lib/address";
import {
  Address,
  ConfidenceLevels,
  EpcData,
  ExtractedPropertyScrapingData,
} from "@/types/property";
import { QueryClient } from "@tanstack/react-query";

interface ParsedAddress {
  buildingGuess: string | null;
  streetGuess: string | null;
  townGuess: string | null;
  postcodeGuess: string | null;
}

interface PrepareActivationContextArgs {
  currentPropertyId: string | null | undefined;
  propertyDataSource: ExtractedPropertyScrapingData | null | undefined;
  queryClient: QueryClient;
  parseDisplayAddressFn?: (displayAddress: string | null, postcode: string | null) => ParsedAddress;
  reactQueryKeys: typeof REACT_QUERY_KEYS;
  confidenceLevels: typeof ConfidenceLevels;
}

interface PrepareActivationContextReturn {
  addressForContext: Address | null;
  epcForContext: EpcData | null;
  parsingAttempted: boolean;
  error?: "MISSING_INITIAL_DATA";
}

export const prepareActivationContextAndAddress = ({
  currentPropertyId,
  propertyDataSource,
  queryClient,
  reactQueryKeys,
  confidenceLevels,
}: PrepareActivationContextArgs): PrepareActivationContextReturn => {
  if (!currentPropertyId || !propertyDataSource?.address || !propertyDataSource?.epc) {
    return {
      addressForContext: null,
      epcForContext: null,
      parsingAttempted: false,
      error: "MISSING_INITIAL_DATA",
    };
  }

  const initialAddress: Address = { ...propertyDataSource.address };
  const epcForContext: EpcData = propertyDataSource.epc;

  const needsParsing =
    !initialAddress.confirmedStreet?.trim() ||
    !initialAddress.confirmedTown?.trim() ||
    !initialAddress.confirmedPostcode?.trim();

  if (needsParsing && currentPropertyId) {
    const parsedFromDisplay = parseDisplayAddress(
      initialAddress.displayAddress,
      initialAddress.postcode
    );

    queryClient.setQueryData<ExtractedPropertyScrapingData | undefined>(
      [reactQueryKeys.PROPERTY_DATA, currentPropertyId],
      (oldData) => {
        if (!oldData || !oldData.address) return oldData;
        const updatedAddressInCache: Address = {
          ...oldData.address,
          confirmedBuilding:
            parsedFromDisplay.buildingGuess?.trim() || oldData.address.confirmedBuilding,
          confirmedStreet: parsedFromDisplay.streetGuess?.trim() || oldData.address.confirmedStreet,
          confirmedTown: parsedFromDisplay.townGuess?.trim() || oldData.address.confirmedTown,
          confirmedPostcode:
            parsedFromDisplay.postcodeGuess?.trim() || oldData.address.confirmedPostcode,
          isAddressConfirmedByUser: false,
          addressConfidence:
            parsedFromDisplay.streetGuess ||
            parsedFromDisplay.townGuess ||
            parsedFromDisplay.postcodeGuess
              ? confidenceLevels.USER_PROVIDED
              : oldData.address.addressConfidence,
        };
        return { ...oldData, address: updatedAddressInCache };
      }
    );

    const addressToReturnImmediately: Address = {
      ...initialAddress,
      confirmedBuilding:
        parsedFromDisplay.buildingGuess?.trim() || initialAddress.confirmedBuilding,
      confirmedStreet: parsedFromDisplay.streetGuess?.trim() || initialAddress.confirmedStreet,
      confirmedTown: parsedFromDisplay.townGuess?.trim() || initialAddress.confirmedTown,
      confirmedPostcode:
        parsedFromDisplay.postcodeGuess?.trim() || initialAddress.confirmedPostcode,
      isAddressConfirmedByUser: false,
      addressConfidence:
        parsedFromDisplay.streetGuess ||
        parsedFromDisplay.townGuess ||
        parsedFromDisplay.postcodeGuess
          ? confidenceLevels.USER_PROVIDED
          : initialAddress.addressConfidence,
    };

    return {
      addressForContext: addressToReturnImmediately,
      epcForContext,
      parsingAttempted: true,
    };
  }

  return {
    addressForContext: initialAddress,
    epcForContext,
    parsingAttempted: false,
  };
};
