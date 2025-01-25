import { ActionEvents } from './constants/actionEvents';
import { storeDataForTab } from './storage';

console.log("Background script loaded");

// Enable opening the side panel when the action button is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

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