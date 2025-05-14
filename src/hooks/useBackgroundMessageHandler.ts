import { ActionEvents } from "@/constants/actionEvents";
import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { extractPropertyIdFromUrl } from "@/sidepanel/helpers";
import { ConfidenceLevels, ExtractedPropertyScrapingData } from "@/types/property";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { checkAndTriggerPremiumSearchOnPropertyIdMatch } from "./helpers/backgroundMessageToUiHelpers";
import { usePersistentPremiumData } from "./usePersistentPremiumData";
import { useSecureAuthentication } from "./useSecureAuthentication";
import { useUserProfile } from "./useUserProfile";

interface UseBackgroundMessageHandlerResult {
  isPropertyDataLoading: boolean;
  nonPropertyPageWarningMessage: string | null;
  currentPropertyId: string | null;
}

export const useBackgroundMessageHandler = (): UseBackgroundMessageHandlerResult => {
  const queryClient = useQueryClient();
  const [isPropertyDataLoading, setIsPropertyDataLoading] = useState<boolean>(true);
  const [nonPropertyPageWarningMessage, setNonPropertyPageWarningMessage] = useState<string | null>(
    null
  );
  const [currentPropertyId, setCurrentPropertyId] = useState<string | null>(null);
  const autoTriggerPendingForIdRef = useRef<string | null>(null);

  const { isAuthenticated } = useSecureAuthentication();
  const { userProfile } = useUserProfile();
  const { activatePremiumSearch } = usePersistentPremiumData();

  // Ref to hold the latest message handling logic
  const latestMessageHandlerRef = useRef<any>(null);

  useEffect(() => {
    // This function captures the current state of all dependencies on each render
    // and is stored in the ref.
    latestMessageHandlerRef.current = (
      message: { action: string; data?: any },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: any) => void
    ) => {
      console.log(
        "[Background Handler Hook] Received message (via ref):",
        message,
        "Auth:",
        isAuthenticated
      );

      const propertyId = (() => {
        if (message.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
          return extractPropertyIdFromUrl(message.data) ?? null;
        } else if (message.action === ActionEvents.PROPERTY_PAGE_OPENED) {
          return message.data?.propertyId ?? null;
        }
        return null;
      })();

      setCurrentPropertyId(propertyId); // This will trigger re-render if value changes

      if (message.action === ActionEvents.PROPERTY_PAGE_OPENED && propertyId) {
        console.log(`[Background Handler Hook] Handling PROPERTY_PAGE_OPENED for ${propertyId}`);
        console.log(
          `[useBackgroundMessageHandler] Inside PROPERTY_PAGE_OPENED block. PropertyId: ${propertyId}, Current loading state: ${isPropertyDataLoading}`
        );

        const incomingData = message.data as ExtractedPropertyScrapingData;

        // --- DIAGNOSTIC LOG ---
        console.log(
          "[SidePanel Hook] Received PROPERTY_PAGE_OPENED with incomingData:",
          JSON.parse(JSON.stringify(incomingData)) // Deep copy for clean logging
        );
        if (incomingData?.address) {
          console.log(
            "[SidePanel Hook] Address Confidence:",
            incomingData.address.addressConfidence
          );
          console.log("[SidePanel Hook] Address Display:", incomingData.address.displayAddress);
          console.log(
            "[SidePanel Hook] Address Source:",
            // @ts-ignore
            incomingData.address.source
          );
          console.log(
            "[SidePanel Hook] Gov EPC Suggestions:",
            incomingData.address.govEpcRegisterSuggestions
          );
        }
        if (incomingData?.epc) {
          console.log("[SidePanel Hook] EPC Value:", incomingData.epc.value);
          console.log("[SidePanel Hook] EPC Confidence:", incomingData.epc.confidence);
          console.log("[SidePanel Hook] EPC Source:", incomingData.epc.source);
        }
        // --- END DIAGNOSTIC LOG ---

        const cachedData = queryClient.getQueryData<ExtractedPropertyScrapingData>([
          REACT_QUERY_KEYS.PROPERTY_DATA,
          propertyId,
        ]);

        const dataToUpdate: ExtractedPropertyScrapingData = (() => {
          if (cachedData && cachedData.epc?.confidence === ConfidenceLevels.USER_PROVIDED) {
            console.log(
              "[Background Handler Hook] Preserving user-provided EPC from cache for propertyId:",
              propertyId
            );
            return {
              ...incomingData,
              epc: cachedData.epc,
            };
          } else {
            return incomingData;
          }
        })();

        console.log(
          "[SidePanel Hook] Final EPC being set to cache:",
          JSON.parse(JSON.stringify(dataToUpdate.epc))
        );
        queryClient.setQueryData([REACT_QUERY_KEYS.PROPERTY_DATA, propertyId], dataToUpdate);
        console.log(
          `[useBackgroundMessageHandler] About to call setIsPropertyDataLoading(false). Current propertyId: ${propertyId}`
        );
        setIsPropertyDataLoading(false);
        setNonPropertyPageWarningMessage(null);
        console.log(
          "[Background Handler Hook] RQ Cache updated with final data for propertyId:",
          propertyId,
          dataToUpdate
        );
      } else if (message.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
        console.log("[Background Handler Hook] Handling TAB_CHANGED_OR_EXTENSION_OPENED");
        if (!propertyId) {
          console.log("[Background Handler Hook] No propertyId found in URL. Setting warning.");
          setNonPropertyPageWarningMessage("Please open a property page on rightmove.co.uk.");
          setIsPropertyDataLoading(false);
        } else {
          console.log(`[Background Handler Hook] PropertyId ${propertyId} found in URL.`);
          setNonPropertyPageWarningMessage(null);
          const isCached = !!queryClient.getQueryData([REACT_QUERY_KEYS.PROPERTY_DATA, propertyId]);
          console.log(
            `[Background Handler Hook] Property data cached locally for ${propertyId}: ${isCached}`
          );
          setIsPropertyDataLoading(!isCached);
        }
      } else if (message.action === ActionEvents.SHOW_WARNING) {
        console.log("[Background Handler Hook] Handling SHOW_WARNING");
        setNonPropertyPageWarningMessage(
          message.data || "Please open a property page on rightmove.co.uk."
        );
        setIsPropertyDataLoading(false);
      }

      console.log(
        `[Handler] Calling checkAndTrigger. propertyId: ${propertyId}, pendingIdRef: ${autoTriggerPendingForIdRef.current}, auth: ${isAuthenticated}`
      );
      checkAndTriggerPremiumSearchOnPropertyIdMatch({
        propertyId,
        isAuthenticated, // Uses current value from hook's scope
        userProfile, // Uses current value from hook's scope
        queryClient,
        activatePremiumSearch, // Uses current value from hook's scope
        autoTriggerPendingForIdRef: autoTriggerPendingForIdRef,
      });

      sendResponse({ status: "acknowledged", action: message.action });
    };
  }); // Runs on every render to keep latestMessageHandlerRef.current up-to-date

  useEffect(() => {
    // This effect runs only once to add/remove the stable listener
    const stableListenerWrapper = (
      message: { action: string; data?: any },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: any) => void
    ) => {
      if (latestMessageHandlerRef.current) {
        latestMessageHandlerRef.current(message, sender, sendResponse);
      }
    };

    console.log("[Background Handler Hook] ADDING STABLE listener.");
    chrome.runtime.onMessage.addListener(stableListenerWrapper);

    return () => {
      console.log("[Background Handler Hook] REMOVING STABLE listener.");
      chrome.runtime.onMessage.removeListener(stableListenerWrapper);
    };
  }, []); // Empty dependency array: runs only on mount and unmount

  // This effect correctly depends on currentPropertyId
  useEffect(() => {
    autoTriggerPendingForIdRef.current = null;
    console.log(
      `[Lock Reset Effect] Cleared lock due to propertyId change to: ${currentPropertyId}`
    );
  }, [currentPropertyId]);

  return { isPropertyDataLoading, nonPropertyPageWarningMessage, currentPropertyId };
};
