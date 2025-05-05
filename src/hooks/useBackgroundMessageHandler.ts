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

  useEffect(() => {
    autoTriggerPendingForIdRef.current = null;
    console.log(
      `[Lock Reset Effect] Cleared lock due to propertyId change to: ${currentPropertyId}`
    );
  }, [currentPropertyId]);

  useEffect(() => {
    const handleMessage = (
      message: { action: string; data?: any },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: any) => void
    ) => {
      console.log("[Background Handler Hook] Received message:", message);

      const propertyId = (() => {
        if (message.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
          return extractPropertyIdFromUrl(message.data) ?? null;
        } else if (message.action === ActionEvents.PROPERTY_PAGE_OPENED) {
          return message.data?.propertyId ?? null;
        }
        return null;
      })();

      setCurrentPropertyId(propertyId);

      if (message.action === ActionEvents.PROPERTY_PAGE_OPENED && propertyId) {
        console.log(`[Background Handler Hook] Handling PROPERTY_PAGE_OPENED for ${propertyId}`);
        const incomingData = message.data as ExtractedPropertyScrapingData;
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

        queryClient.setQueryData([REACT_QUERY_KEYS.PROPERTY_DATA, propertyId], dataToUpdate);
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

      // --- Call the Auto-trigger Helper Function ---
      console.log(
        `[Handler] Calling checkAndTrigger. propertyId: ${propertyId}, pendingIdRef: ${autoTriggerPendingForIdRef.current}`
      );
      checkAndTriggerPremiumSearchOnPropertyIdMatch({
        propertyId,
        isAuthenticated,
        userProfile,
        queryClient,
        activatePremiumSearch,
        autoTriggerPendingForIdRef: autoTriggerPendingForIdRef,
      });

      sendResponse({ status: "acknowledged", action: message.action });
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [queryClient, isAuthenticated, userProfile, activatePremiumSearch]);

  return { isPropertyDataLoading, nonPropertyPageWarningMessage, currentPropertyId };
};
