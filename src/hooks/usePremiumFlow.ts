import { useCallback, useState } from "react";

interface UsePremiumFlowProps {
  isAuthenticated: boolean;
  isAddressConfirmed: boolean;
  openAddressConfirmationModal: () => void;
  onConfirmAndActivate: () => void;
}

// This hook is managing the user's premium status, gating features, handling upgrade prompts etc
// See usePremiumStreetData.ts for fetching the premium street data
// See useChecklistAndDashboardData.ts for processing the street data
export const usePremiumFlow = ({
  isAuthenticated,
  isAddressConfirmed,
  openAddressConfirmationModal,
  onConfirmAndActivate,
}: UsePremiumFlowProps) => {
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showPremiumConfirmationModal, setShowPremiumConfirmationModal] = useState(false);
  const [addressConfirmationPending, setAddressConfirmationPending] = useState(false);

  const triggerPremiumFlow = useCallback(() => {
    if (!isAuthenticated) {
      console.log("User not authenticated, showing upsell modal.");
      setShowUpsellModal(true);
    } else {
      if (!isAddressConfirmed) {
        console.log(
          "User authenticated, address not confirmed. Setting pending flag and opening address confirmation."
        );
        setAddressConfirmationPending(true);
        openAddressConfirmationModal();
      } else {
        console.log(
          "User authenticated and address confirmed. Showing premium confirmation modal."
        );
        setAddressConfirmationPending(false);
        setShowPremiumConfirmationModal(true);
      }
    }
  }, [isAuthenticated, isAddressConfirmed, openAddressConfirmationModal]);

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
