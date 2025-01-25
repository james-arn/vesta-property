export function storeDataForTab(data: any) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (typeof tabId === 'number') {
            const key = tabId.toString();
            chrome.storage.local.set({ [key]: data }, () => {
                console.log(`Data stored for tab ${tabId}, data: ${data}`);
            });
        } else {
            console.error(`Failed to get active tab ID: ${tabId}, data: ${JSON.stringify(data, null, 2)}`);
        }
    });
}

// The retrieveDataForTab function takes a callback function as its parameter.
// This callback is called with the data retrieved from chrome.storage.
export function retrieveDataForTab(callback: (data: any) => void) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        console.log(`Retrieving data for tab: ${tabId}`);
        if (typeof tabId === 'number') {
            const key = tabId.toString();
            chrome.storage.local.get([key], (result) => {
                const data = result[key];
                console.log(`Data retrieved for tab ${tabId}, result: ${JSON.stringify(result, null, 2)}, data: ${JSON.stringify(data, null, 2)}`);
                callback(data);
            });
        } else {
            console.error(`Failed to get active tab ID: ${tabId}`);
            callback(null);
        }
    });
}

