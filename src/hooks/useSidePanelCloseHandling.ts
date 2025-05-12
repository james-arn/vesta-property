import { ActionEvents } from "@/constants/actionEvents";
import { useEffect } from "react";

/**
 * Custom hook to handle side panel close functionality.
 *
 * This hook sets up:
 * 1. A message listener for BACKGROUND_COMMANDS_SIDE_PANEL_CLOSE events
 * 2. A beforeunload handler to notify when the panel is closing
 *
 * @returns void
 */
export const useSidePanelCloseHandling = (): void => {
  useEffect(() => {
    const messageListener = (
      request: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (request.action === ActionEvents.BACKGROUND_COMMANDS_SIDE_PANEL_CLOSE) {
        const queryParams = new URLSearchParams(location.search);
        const ownTabIdString = queryParams.get("tabId");
        // Fallback to querying active tab if not in URL (though for close, it should have been opened with tabId)
        const ownTabId = ownTabIdString ? parseInt(ownTabIdString, 10) : null;

        // Check if this side panel instance is the target for the close command.
        // ownTabId might be null if somehow the side panel URL didn't get tabId properly upon opening.
        // request.targetTabId comes from the background script, based on the tab that initiated the close.
        if (request.targetTabId && ownTabId === request.targetTabId) {
          window.close(); // Close the side panel window
        } else if (!ownTabId && request.targetTabId) {
          // If ownTabId couldn't be determined from URL, but a targetTabId is present,
          // we might infer it should close if it's the only side panel for that tab, but this is risky.
          // A safer approach for now: only close if ownTabId is known and matches.
          // For safety, let's try to get current tabId again if ownTabId was null from URL.
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0 && tabs[0].id === request.targetTabId) {
              window.close();
            }
          });
        }
      }
      // Return false since we're not using sendResponse asynchronously
      return false;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const queryParams = new URLSearchParams(location.search);
      const tabIdFromUrlString = queryParams.get("tabId");
      let ownTabId: number | undefined = tabIdFromUrlString
        ? parseInt(tabIdFromUrlString, 10)
        : undefined;

      // If tabId couldn't be determined from URL (shouldn't happen if panel was opened correctly with tabId),
      // we can't reliably send the targeted closing message.
      // However, by this point, it should have a tabId.
      if (typeof ownTabId === "number") {
        // This is a fire-and-forget message. The browser might close the window before a response is received.
        chrome.runtime.sendMessage({
          action: ActionEvents.SIDE_PANEL_IS_NOW_CLOSING,
          tabId: ownTabId,
        });
      } else {
        // Attempt to get tabId via active query as a last resort, though less reliable for unload.
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs.length > 0 && tabs[0].id) {
            const activeTabId = tabs[0].id;
            chrome.runtime.sendMessage({
              action: ActionEvents.SIDE_PANEL_IS_NOW_CLOSING,
              tabId: activeTabId,
            });
          }
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
};
