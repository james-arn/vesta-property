import { logErrorToSentry } from "./utils/sentry";

export function storeDataToStorage(key: string, data: any, callback?: () => void) {
  try {
    // Attempt to serialize the data to ensure it's JSON-compatible
    JSON.stringify(data);

    chrome.storage.local.set({ [key]: data }, () => {
      console.log(
        `Data stored successfully under key "${key}", data: ${JSON.stringify(data, null, 2)}`
      );
      if (callback) {
        callback();
      }
    });
  } catch (error) {
    logErrorToSentry(
      `Failed to store data under key "${key}": ${JSON.stringify(data, null, 2)}, error: ${error}`
    );
  }
}

export function retrieveDataFromStorage(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get([key], (result) => {
        const data = result[key];
        if (data !== undefined) {
          console.log(
            `Data retrieved successfully under key "${key}", data: ${JSON.stringify(data, null, 2)}`
          );
          resolve(data);
        } else {
          logErrorToSentry(`No data found for key: ${key}`);
          resolve(null); // Resolve with null if no data is found
        }
      });
    } catch (error) {
      logErrorToSentry(`Failed to retrieve data under key "${key}", error: ${error}`);
      reject(error);
    }
  });
}
