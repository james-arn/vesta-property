import { ActionEvents } from './constants/actionEvents';
import { ResponseType, ShowWarningMessage, TabChangedOrExtensionOpenedMessage, UpdatePropertyDataMessage } from './types/messages';

console.log("[background.ts] Background script loaded");
// Background.ts is the central hub
// Listens for messages from the sidebar or content script.
// Sends commands to the content script to scrape data.
// Relays data between the content script and sidebar.

function sendWarningMessage(logMessage: string) {
    console.warn(logMessage);
    const warningMessage: ShowWarningMessage = {
        action: ActionEvents.SHOW_WARNING,
        message: 'Please open a property page on rightmove.co.uk.'
    };
    chrome.runtime.sendMessage<ShowWarningMessage, ResponseType>(warningMessage, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[background.ts] Error sending warning message:', chrome.runtime.lastError);
        } else {
            console.log('[background.ts] Warning message sent successfully:', response);
        }
    });
}

// Function to update the stored URL and send a message
function handleInitialLoadOrTabChange() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0 || !tabs[0].url) {
            console.warn('No active tab found or tab has no URL.');
            return;
        }

        const currentUrl = tabs[0].url;
        console.log('[background.ts] Updated last URL:', currentUrl);
        const tabId = tabs[0]?.id;

        if (typeof tabId !== 'number') {
            console.warn('Tab has no valid ID.');
            return;
        }

        if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('about:')) {
            sendWarningMessage('Internal Chrome page detected. Sending warning directly.');
            return;
        }

        const message: TabChangedOrExtensionOpenedMessage = {
            action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
            url: currentUrl
        };
        console.log('[background.ts] Sending message to tab:', tabId, message);
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[background.ts] Error sending message:', chrome.runtime.lastError);
                if (chrome.runtime.lastError?.message?.includes('Could not establish connection')) {
                    sendWarningMessage('Content script not loaded. Sending warning directly.');
                }
            } else {
                console.log('[background.ts] Message sent successfully:', response);
            }
        });
    });
}



// Tab activation changes
chrome.tabs.onActivated.addListener(handleInitialLoadOrTabChange);

// Tab updates (e.g., when the URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.active) {
        handleInitialLoadOrTabChange();
    }
});

// Tab Creation
chrome.tabs.onCreated.addListener((tab) => {
    console.log('[background.ts] New tab created:', tab);
    // Handle initial load or tab change for the new tab
    handleInitialLoadOrTabChange();
});

// Set panel behavior and update URL when the panel is opened
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Listen for messages from the content script and store data.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === ActionEvents.SIDE_PANEL_OPENED) {
        console.log('[background.ts] Side panel opened');
        handleInitialLoadOrTabChange();
        sendResponse({ status: 'Handled side panel opened' });
    }

    if (request.action === ActionEvents.UPDATE_PROPERTY_DATA) {
        console.log('[background.ts] Property Data:', request.data);
        // Forward the message to the UI
        chrome.runtime.sendMessage<UpdatePropertyDataMessage, ResponseType>(request, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[background.ts] Error forwarding message:', chrome.runtime.lastError);
            } else {
                console.log('[background.ts] Message forwarded to UI:', request);
                console.log('[background.ts] Response:', response);
            }
        });
    }
    if (request.action === ActionEvents.SHOW_WARNING) {
        console.log('[background.ts] Warning Message:', request.message);
        // Forward the message to the UI
        chrome.runtime.sendMessage<ShowWarningMessage, ResponseType>(request, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[background.ts] Error forwarding message:', chrome.runtime.lastError);
            } else {
                console.log('[background.ts] Message forwarded to UI:', request);
            }
        });
    }
});

// Listen for tab switches
chrome.tabs.onActivated.addListener((activeInfo) => {
    // Get the active tab's URL
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url) {
            // Send the URL to the sidebar
            chrome.runtime.sendMessage<TabChangedOrExtensionOpenedMessage, ResponseType>({
                action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED, url: tab.url
            });
        }
    });
});

// Optionally, listen for tab updates (e.g., when the page reloads or URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.active) {
        chrome.runtime.sendMessage<TabChangedOrExtensionOpenedMessage, ResponseType>({
            action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED, url: tab.url ?? ''
        });
    }
});