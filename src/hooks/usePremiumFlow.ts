import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { parseDisplayAddress } from "@/lib/address";
import {
  Address,
  Confidence,
  ConfidenceLevels,
  ExtractedPropertyScrapingData,
} from "@/types/property";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

interface UsePremiumFlowProps {
  isAuthenticated: boolean;
  isAddressConfirmed: boolean;
  addressConfidence: Confidence | null | undefined;
  openAddressConfirmationModal: () => void;
  onConfirmAndActivate: () => void;
  currentPropertyId: string | null;
  propertyAddress: Address | null | undefined;
}

// This hook is managing the user's premium status, gating features, handling upgrade prompts etc
// See usePremiumStreetData.ts for fetching the premium street data
// See useChecklistAndDashboardData.ts for processing the street data
export const usePremiumFlow = ({
  isAuthenticated,
  isAddressConfirmed,
  addressConfidence,
  openAddressConfirmationModal,
  onConfirmAndActivate,
  currentPropertyId,
  propertyAddress,
}: UsePremiumFlowProps) => {
  const queryClient = useQueryClient();
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showPremiumConfirmationModal, setShowPremiumConfirmationModal] = useState(false);
  const [addressConfirmationPending, setAddressConfirmationPending] = useState(false);

  const triggerPremiumFlow = useCallback(async () => {
    console.log(
      "[PremiumFlow] Triggered. Auth:",
      isAuthenticated,
      "Address Confirmed:",
      isAddressConfirmed,
      "Address Confidence:",
      addressConfidence,
      "Property Address:",
      propertyAddress
    );
    if (!isAuthenticated) {
      console.log("[PremiumFlow] User not authenticated, showing upsell modal.");
      setShowUpsellModal(true);
    } else {
      if (
        isAddressConfirmed ||
        addressConfidence === ConfidenceLevels.HIGH ||
        addressConfidence === ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED
      ) {
        console.log(
          "[PremiumFlow] User authenticated. Address confirmed by user, high confidence from scrape, or confirmed by GOV EPC."
        );
        if (
          !isAddressConfirmed &&
          (addressConfidence === ConfidenceLevels.HIGH ||
            addressConfidence === ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED) &&
          currentPropertyId &&
          propertyAddress?.displayAddress
        ) {
          console.log(
            "[PremiumFlow] High confidence scrape or GOV EPC: Parsing displayAddress and updating cache before premium confirmation."
          );
          const parsed = parseDisplayAddress(
            propertyAddress.displayAddress,
            propertyAddress.postcode
          );
          queryClient.setQueryData<ExtractedPropertyScrapingData | undefined>(
            [REACT_QUERY_KEYS.PROPERTY_DATA, currentPropertyId],
            (oldData) => {
              if (!oldData) return undefined;
              return {
                ...oldData,
                address: {
                  ...(oldData.address || {}),
                  displayAddress: propertyAddress.displayAddress,
                  postcode: propertyAddress.postcode || parsed.postcodeGuess,
                  confirmedBuilding: parsed.buildingGuess,
                  confirmedStreet: parsed.streetGuess,
                  confirmedTown: parsed.townGuess,
                  confirmedPostcode: parsed.postcodeGuess || propertyAddress.postcode,
                  isAddressConfirmedByUser: true,
                  addressConfidence: addressConfidence,
                },
              };
            }
          );
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        console.log("[PremiumFlow] Proceeding to show premium confirmation modal.");
        setAddressConfirmationPending(false);
        setShowPremiumConfirmationModal(true);
      } else {
        console.log(
          "[PremiumFlow] User authenticated. Address NOT confirmed by user AND confidence NOT high. Opening address confirmation."
        );
        setAddressConfirmationPending(true);
        openAddressConfirmationModal();
      }
    }
  }, [
    isAuthenticated,
    isAddressConfirmed,
    addressConfidence,
    openAddressConfirmationModal,
    currentPropertyId,
    propertyAddress,
    queryClient,
  ]);

  const notifyAddressConfirmed = useCallback(() => {
    console.log("notifyAddressConfirmed called. Pending:", addressConfirmationPending);
    if (addressConfirmationPending) {
      setAddressConfirmationPending(false);
      setShowPremiumConfirmationModal(true);
    }
  }, [addressConfirmationPending]);

  const handleConfirmPremiumSearch = useCallback(() => {
    console.log("User confirmed premium search (spending token). Activating fetch...");
    onConfirmAndActivate();
    setShowPremiumConfirmationModal(false);
  }, [onConfirmAndActivate]);

  return {
    triggerPremiumFlow,
    showUpsellModal,
    setShowUpsellModal,
    showPremiumConfirmationModal,
    setShowPremiumConfirmationModal,
    premiumConfirmationHandler: handleConfirmPremiumSearch,
    notifyAddressConfirmed,
  };
};
