import { ActionEvents } from './constants/actionEvents';
import { storeDataForTab } from './storage';

console.log("Background script loaded");
// Background.ts is the central hub
// Listens for messages from the sidebar or content script.
// Sends commands to the content script to scrape data.
// Relays data between the content script and sidebar.

// Enable opening the side panel when the action button is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Listen for messages from the content script and store data.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === ActionEvents.UPDATE_PROPERTY_DATA) {
        console.log('Property Data:', request.data);
        storeDataForTab({ propertyData: request.data, action: ActionEvents.UPDATE_PROPERTY_DATA });
    }
    if (request.action === ActionEvents.SHOW_WARNING) {
        storeDataForTab({ message: request.message, action: ActionEvents.SHOW_WARNING });
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    chrome.storage.local.remove(tabId.toString(), () => {
        console.log(`Data cleared for tab ${tabId}`);
    });
});

// Listen for tab switches
chrome.tabs.onActivated.addListener((activeInfo) => {
    // Get the active tab's URL
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url) {
            // Send the URL to the sidebar
            chrome.runtime.sendMessage({ action: ActionEvents.TAB_CHANGED, url: tab.url });
        }
    });
});

// Optionally, listen for tab updates (e.g., when the page reloads or URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.active) {
        chrome.runtime.sendMessage({ action: ActionEvents.TAB_CHANGED, url: tab.url });
    }
});