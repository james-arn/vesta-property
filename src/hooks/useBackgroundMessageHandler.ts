import { ActionEvents } from "@/constants/actionEvents";
import { emptyPropertyData } from "@/constants/emptyPropertyData";
import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { extractPropertyIdFromUrl } from "@/sidepanel/helpers";
import { PropertyReducerAction, PropertyReducerActionTypes } from "@/sidepanel/propertyReducer";
import { ExtractedPropertyScrapingData } from "@/types/property";
import { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface UseBackgroundMessageHandlerResult {
  isPropertyDataLoading: boolean;
  nonPropertyPageWarningMessage: string | null;
}

export const useBackgroundMessageHandler = (
  dispatch: React.Dispatch<PropertyReducerAction>,
  queryClient: QueryClient
): UseBackgroundMessageHandlerResult => {
  const [isPropertyDataLoading, setIsPropertyDataLoading] = useState<boolean>(true);
  const [nonPropertyPageWarningMessage, setNonPropertyPageWarningMessage] = useState<string | null>(
    null
  );

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
        if (!propertyIdFromTabUrl) {
          console.log("!propertyIdFromTabUrl");
          setNonPropertyPageWarningMessage("Please open a property page on rightmove.co.uk.");
          setIsPropertyDataLoading(false);
          dispatch({
            type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA,
            payload: emptyPropertyData,
          });
        } else {
          setNonPropertyPageWarningMessage(null);
          setIsPropertyDataLoading(true);
          const cachedPropertyData = queryClient.getQueryData<ExtractedPropertyScrapingData>([
            REACT_QUERY_KEYS.PROPERTY_DATA,
            propertyIdFromTabUrl,
          ]);
          if (cachedPropertyData) {
            console.log("cached");
            dispatch({
              type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA,
              payload: cachedPropertyData,
            });
            setIsPropertyDataLoading(false);
          } else {
            console.log("not-cached");
            // Still set loading false even if not cached, scraper will update later if needed
            setIsPropertyDataLoading(false);
            dispatch({
              type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA,
              payload: emptyPropertyData,
            });
          }
        }
      } else if (message.action === ActionEvents.PROPERTY_PAGE_OPENED) {
        queryClient.setQueryData(
          [REACT_QUERY_KEYS.PROPERTY_DATA, message.data.propertyId],
          message.data
        );
        dispatch({
          type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA,
          payload: message.data,
        });
        setIsPropertyDataLoading(false);
        setNonPropertyPageWarningMessage(null);
        console.log("[Background Handler Hook] Property data updated:", message.data);
      } else if (message.action === ActionEvents.SHOW_WARNING) {
        console.log("showing warning");
        setNonPropertyPageWarningMessage(message.data || null);
        setIsPropertyDataLoading(false);
        dispatch({
          type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA,
          payload: emptyPropertyData,
        });
        console.log("[Background Handler Hook] Warning message set:", message.data);
      }
      sendResponse({ status: "acknowledged", action: message.action });
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [queryClient, dispatch]); // Dependencies are queryClient and dispatch

  return { isPropertyDataLoading, nonPropertyPageWarningMessage };
};
