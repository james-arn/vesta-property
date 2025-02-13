const GA_ENDPOINT = process.env.GA_ENDPOINT;
const MEASUREMENT_ID = process.env.MEASUREMENT_ID;
const API_SECRET = process.env.API_SECRET;
const DEFAULT_ENGAGEMENT_TIME_IN_MSEC = 100;
const SESSION_EXPIRATION_IN_MIN = 30;

/**
 * Retrieves or creates a unique client ID using chrome.storage.local.
 */
export async function getOrCreateClientId(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("clientId", (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      let clientId = result.clientId;
      if (!clientId) {
        clientId = crypto.randomUUID();
        chrome.storage.local.set({ clientId }, () => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve(clientId);
        });
      } else {
        resolve(clientId);
      }
    });
  });
}

/**
 * Retrieves or creates a session ID stored in chrome.storage.session.
 * A session expires after 30 minutes of inactivity.
 */
export async function getOrCreateSessionId(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.session.get("sessionData", (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      let sessionData = result.sessionData;
      const currentTime = Date.now();
      if (sessionData && sessionData.timestamp) {
        const durationInMin = (currentTime - parseInt(sessionData.timestamp)) / 60000;
        if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
          sessionData = null;
        } else {
          sessionData.timestamp = currentTime.toString();
          chrome.storage.session.set({ sessionData });
        }
      }
      if (!sessionData) {
        sessionData = {
          session_id: currentTime.toString(),
          timestamp: currentTime.toString(),
        };
        chrome.storage.session.set({ sessionData });
      }
      resolve(sessionData.session_id);
    });
  });
}

/**
 * Sends an event to GA4 using the Measurement Protocol.
 *
 * @param eventName - The name of the event
 * @param params - Additional parameters to send with the event
 */
export async function sendGA4Event(eventName: string, params: Record<string, any>): Promise<void> {
  try {
    const clientId = await getOrCreateClientId();
    if (!params.session_id) {
      params.session_id = await getOrCreateSessionId();
    }
    if (!params.engagement_time_msec) {
      params.engagement_time_msec = DEFAULT_ENGAGEMENT_TIME_IN_MSEC;
    }

    const payload = {
      client_id: clientId,
      events: [
        {
          name: eventName,
          params,
        },
      ],
    };

    await fetch(`${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Error sending analytics event:", error);
  }
}
