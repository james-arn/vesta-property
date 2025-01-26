import { ActionEvents } from './constants/actionEvents';
import { StorageKeys } from './constants/storage';
import { storeDataToStorage } from './storageHelpers';

console.log("Background script loaded");
// Background.ts is the central hub
// Listens for messages from the sidebar or content script.
// Sends commands to the content script to scrape data.
// Relays data between the content script and sidebar.

// Function to update the stored URL and send a message
function handleInitialLoadOrTabChange() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0 && tabs[0].url) {
            const currentUrl = tabs[0].url;
            storeDataToStorage(StorageKeys.LAST_URL, currentUrl, () => {
                console.log('Updated last URL:', currentUrl);
                const tabId = tabs[0]?.id;
                if (typeof tabId === 'number') {
                    const message = {
                        action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED,
                        url: currentUrl
                    };
                    console.log('Sending message to tab:', tabId, message);
                    chrome.tabs.sendMessage(tabId, message, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error sending message:', chrome.runtime.lastError);
                        } else {
                            console.log('Message sent successfully:', response);
                        }
                    });
                } else {
                    console.warn('No active tab found or tab has no ID.');
                }
            });
        } else {
            console.warn('No active tab found or tab has no URL.');
        }
    });
}

// Listen for tab activation changes
chrome.tabs.onActivated.addListener(handleInitialLoadOrTabChange);

// Listen for tab updates (e.g., when the URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.active) {
        handleInitialLoadOrTabChange();
    }
});

// Set panel behavior and update URL when the panel is opened
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .then(() => {
        console.log('Side panel behavior set');
        handleInitialLoadOrTabChange();
    })
    .catch((error) => console.error(error));

// Listen for messages from the content script and store data.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === ActionEvents.UPDATE_PROPERTY_DATA) {
        console.log('Property Data:', request.data);
        // Forward the message to the UI
        chrome.runtime.sendMessage(request, () => {
            if (chrome.runtime.lastError) {
                console.error('Error forwarding message:', chrome.runtime.lastError);
            } else {
                console.log('Message forwarded to UI:', request);
            }
        });
    }
    if (request.action === ActionEvents.SHOW_WARNING) {
        console.log('Warning Message:', request.message);
        // Forward the message to the UI
        chrome.runtime.sendMessage(request, () => {
            if (chrome.runtime.lastError) {
                console.error('Error forwarding message:', chrome.runtime.lastError);
            } else {
                console.log('Message forwarded to UI:', request);
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
            chrome.runtime.sendMessage({ action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED, url: tab.url });
        }
    });
});

// Optionally, listen for tab updates (e.g., when the page reloads or URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.active) {
        chrome.runtime.sendMessage({ action: ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED, url: tab.url });
    }
});