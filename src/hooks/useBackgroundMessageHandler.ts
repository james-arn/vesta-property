import { ActionEvents } from "@/constants/actionEvents";
import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { extractPropertyIdFromUrl } from "@/sidepanel/helpers";
import { ConfidenceLevels, ExtractedPropertyScrapingData } from "@/types/property";
import { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface UseBackgroundMessageHandlerResult {
  isPropertyDataLoading: boolean;
  nonPropertyPageWarningMessage: string | null;
  currentPropertyId: string | null;
}

export const useBackgroundMessageHandler = (
  queryClient: QueryClient
): UseBackgroundMessageHandlerResult => {
  const [isPropertyDataLoading, setIsPropertyDataLoading] = useState<boolean>(true);
  const [nonPropertyPageWarningMessage, setNonPropertyPageWarningMessage] = useState<string | null>(
    null
  );
  const [currentPropertyId, setCurrentPropertyId] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (
      message: { action: string; data?: any },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: any) => void
    ) => {
      console.log("[Background Handler Hook] Received message:", message);
      if (message.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
        console.log("TAB_CHANGED_OR_EXTENSION_OPENED hit");
        const propertyIdFromTabUrl = extractPropertyIdFromUrl(message.data);
        setCurrentPropertyId(propertyIdFromTabUrl ?? null);
        if (!propertyIdFromTabUrl) {
          console.log("!propertyIdFromTabUrl");
          setNonPropertyPageWarningMessage("Please open a property page on rightmove.co.uk.");
          setIsPropertyDataLoading(false);
        } else {
          setNonPropertyPageWarningMessage(null);
          setIsPropertyDataLoading(true);
          const cachedPropertyData = queryClient.getQueryData<ExtractedPropertyScrapingData>([
            REACT_QUERY_KEYS.PROPERTY_DATA,
            propertyIdFromTabUrl,
          ]);
          if (cachedPropertyData) {
            console.log("Property data found in RQ cache.");
            setIsPropertyDataLoading(false);
          } else {
            console.log("Property data not yet in RQ cache for:", propertyIdFromTabUrl);
            setIsPropertyDataLoading(false);
          }
        }
      } else if (message.action === ActionEvents.PROPERTY_PAGE_OPENED) {
        const incomingData = message.data as ExtractedPropertyScrapingData;
        const propertyId = incomingData.propertyId;
        setCurrentPropertyId(propertyId);

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
      } else if (message.action === ActionEvents.SHOW_WARNING) {
        console.log("showing warning");
        setNonPropertyPageWarningMessage(message.data || null);
        setIsPropertyDataLoading(false);
      }
      sendResponse({ status: "acknowledged", action: message.action });
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [queryClient]);

  return { isPropertyDataLoading, nonPropertyPageWarningMessage, currentPropertyId };
};
