import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { prepareActivationContextAndAddress } from "@/sidepanel/helpers/premiumActivationHelper";
import { PremiumFetchContext, SnapshotContextData } from "@/types/premiumStreetData";
import { Address, ConfidenceLevels, ExtractedPropertyScrapingData } from "@/types/property";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

interface ToastProps {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface UsePremiumFlowProps {
  isAuthenticated: boolean;
  currentPropertyId: string | null;
  propertyDataSource: ExtractedPropertyScrapingData | null | undefined;
  activatePremiumSearchFunction: (fetchContext: PremiumFetchContext) => void;
  showToast: (props: ToastProps) => void;
}

// This hook is managing the user's premium status, gating features, handling upgrade prompts etc
// See usePremiumStreetData.ts for fetching the premium street data
// See useChecklistAndDashboardData.ts for processing the street data
export const usePremiumFlow = ({
  isAuthenticated,
  currentPropertyId,
  propertyDataSource,
  activatePremiumSearchFunction,
  showToast,
}: UsePremiumFlowProps) => {
  const queryClient = useQueryClient();

  // --- Core Modals State ---
  const [showUpsellModal, setShowUpsellModal] = useState(false); // 1. For non-authenticated users
  const [showBuildingValidationModal, setShowBuildingValidationModal] = useState(false); // 2. For address confirmation/correction
  const [showPremiumConfirmationModal, setShowPremiumConfirmationModal] = useState(false); // 3. For final "spend token" confirmation

  // --- State to manage flow ---
  // This flag tracks if the building validation modal was opened as part of an active premium search initiation
  const [isBuildingModalPartOfActivationFlow, setIsBuildingModalPartOfActivationFlow] =
    useState(false);

  // --- STEP 1: Initiate Premium Activation Flow (e.g., user clicks "Get Premium Data") ---
  const initiatePremiumActivationFlow = useCallback(async () => {
    console.log("[PremiumFlow - Step 1.1] Initiating premium activation flow.");
    setIsBuildingModalPartOfActivationFlow(false); // Reset flag at the start of a new flow

    if (!isAuthenticated) {
      console.log("[PremiumFlow - Step 1.2a] User not authenticated. Showing upsell modal.");
      setShowUpsellModal(true);
      return;
    }

    if (!currentPropertyId || !propertyDataSource) {
      showToast({
        title: "Cannot initiate premium search.",
        description: "Property data is missing.",
        variant: "destructive",
      });
      return;
    }

    console.log("[PremiumFlow - Step 1.2b] User authenticated. Preparing address context.");
    // Attempt to auto-parse/prepare address details
    const { addressForContext, epcForContext, error } = prepareActivationContextAndAddress({
      currentPropertyId,
      propertyDataSource,
      queryClient,
      reactQueryKeys: REACT_QUERY_KEYS,
      confidenceLevels: ConfidenceLevels,
    });

    if (error === "MISSING_INITIAL_DATA" || !addressForContext || !epcForContext) {
      showToast({
        title: "Missing data for premium search.",
        description: "Could not prepare address and EPC data.",
        variant: "destructive",
      });
      return;
    }

    // Check if address is now complete enough after auto-parsing attempt
    // Based on backend validation: confirmedBuilding, confirmedStreet, and confirmedPostcode are required.
    if (
      addressForContext.confirmedBuilding?.trim() &&
      addressForContext.confirmedStreet?.trim() &&
      addressForContext.confirmedPostcode?.trim()
    ) {
      console.log(
        "[PremiumFlow - Step 1.3a] Address is complete (Building, Street, Postcode). Proceeding to Premium Confirmation Modal (Step 3)."
      );
      setShowPremiumConfirmationModal(true); // Skip Building Validation Modal
    } else {
      console.log(
        "[PremiumFlow - Step 1.3b] Address requires manual confirmation (Missing Building, Street, or Postcode). Showing Building Validation Modal (Step 2)."
      );
      setIsBuildingModalPartOfActivationFlow(true); // Set flag: building modal is part of this activation flow
      setShowBuildingValidationModal(true);
    }
  }, [isAuthenticated, currentPropertyId, propertyDataSource, queryClient, showToast]);

  // --- STEP 2: Handle Confirmation from Building Validation Modal ---
  const handleBuildingModalConfirmation = useCallback(
    (
      confirmedAddressParts: Pick<
        Address,
        "confirmedBuilding" | "confirmedStreet" | "confirmedTown" | "confirmedPostcode"
      >
    ) => {
      console.log("[PremiumFlow - Step 2.1] Building validation modal confirmed by user.");
      if (!currentPropertyId) {
        showToast({ title: "Error", description: "Property ID missing.", variant: "destructive" });
        setShowBuildingValidationModal(false);
        return;
      }

      // Update propertyData in RQ cache with user's confirmed address parts
      queryClient.setQueryData<ExtractedPropertyScrapingData | undefined>(
        [REACT_QUERY_KEYS.PROPERTY_DATA, currentPropertyId],
        (oldData) => {
          if (!oldData || !oldData.address) return oldData;

          const buildingAndStreet = [
            confirmedAddressParts.confirmedBuilding?.trim(),
            confirmedAddressParts.confirmedStreet?.trim(),
          ]
            .filter(Boolean)
            .join(" ");

          const newDisplayAddress = [
            buildingAndStreet,
            confirmedAddressParts.confirmedTown?.trim(),
            confirmedAddressParts.confirmedPostcode?.trim(),
          ]
            .filter(Boolean)
            .join(", ");

          const updatedAddress: Address = {
            ...oldData.address,
            ...confirmedAddressParts,
            displayAddress: newDisplayAddress || oldData.address.displayAddress,
            isAddressConfirmedByUser: true,
            addressConfidence: ConfidenceLevels.USER_PROVIDED,
          };
          return { ...oldData, address: updatedAddress };
        }
      );
      console.log("[PremiumFlow - Step 2.2] Address cache updated.");

      // Check if this confirmation was part of an initiated premium flow
      if (isBuildingModalPartOfActivationFlow) {
        console.log(
          "[PremiumFlow - Step 2.3a] Building modal was part of activation flow. Proceeding to Premium Confirmation Modal (Step 3)."
        );
        setShowPremiumConfirmationModal(true);
      } else {
        console.log(
          "[PremiumFlow - Step 2.3b] Building modal was NOT part of activation flow (e.g., manual edit). Address updated. No further automatic action."
        );
      }

      setIsBuildingModalPartOfActivationFlow(false); // Reset the flag
      setShowBuildingValidationModal(false); // Close the building validation modal
    },
    [currentPropertyId, queryClient, showToast, isBuildingModalPartOfActivationFlow] // Added isBuildingModalPartOfActivationFlow to dependencies
  );

  // --- STEP 3 (Final): Confirm and Activate Premium Search (after PremiumConfirmationModal) ---
  const handleConfirmPremiumSearch = useCallback(() => {
    console.log("[PremiumFlow - Step 3.1] User confirmed premium search (spending token).");

    const latestPropertyData = queryClient.getQueryData<ExtractedPropertyScrapingData>([
      REACT_QUERY_KEYS.PROPERTY_DATA,
      currentPropertyId,
    ]);

    if (
      !latestPropertyData ||
      !latestPropertyData.address ||
      !latestPropertyData.epc ||
      !currentPropertyId
    ) {
      showToast({
        title: "Error activating premium search.",
        description: "Could not retrieve latest property details.",
        variant: "destructive",
      });
      setShowPremiumConfirmationModal(false);
      return;
    }

    const snapshotContext: SnapshotContextData = {
      confirmedAddress: latestPropertyData.address,
      epc: latestPropertyData.epc,
    };
    const fetchContextToActivate: PremiumFetchContext = {
      propertyId: currentPropertyId,
      currentContext: snapshotContext,
    };

    console.log(
      "[PremiumFlow - Step 3.2] Activating premium search with context:",
      fetchContextToActivate
    );
    activatePremiumSearchFunction(fetchContextToActivate);
    setShowPremiumConfirmationModal(false); // Close the premium confirmation modal
  }, [activatePremiumSearchFunction, queryClient, currentPropertyId, showToast]);

  return {
    // Functions to control the flow
    initiatePremiumActivationFlow, // Call this to start
    handleBuildingModalConfirmation, // Callback for BuildingConfirmationModal

    // Modal states and setters (for App.tsx to render them)
    showUpsellModal,
    setShowUpsellModal,
    showBuildingValidationModal,
    setShowBuildingValidationModal,
    showPremiumConfirmationModal,
    setShowPremiumConfirmationModal,

    // Handler for the final "confirm spend" action from PremiumConfirmationModal
    premiumConfirmationHandler: handleConfirmPremiumSearch,
  };
};
