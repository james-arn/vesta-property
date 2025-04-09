export const ActionEvents = {
  PAGE_MODEL_AVAILABLE: "pageModelAvailable", // note- used as magic string in injectScript.js due to import syntax issues
  UPDATE_PROPERTY_DATA: "updatePropertyData",
  SHOW_WARNING: "showWarning",
  TAB_CHANGED_OR_EXTENSION_OPENED: "navigatedUrlOrTabChangedOrExtensionOpened",
  SIDE_PANEL_OPENED: "sidePanelOpened",
  // Authentication events
  AUTH_CODE_RECEIVED: "authCodeReceived",
  AUTH_TOKEN_EXCHANGE_SUCCESS: "authTokenExchangeSuccess",
  AUTH_TOKEN_EXCHANGE_FAILURE: "authTokenExchangeFailure",
  AUTH_SUCCESS: "authSuccess", // NOTE - used as magic string in login-success.html & logout-success.html as can't import constants into html files
  LOGOUT_SUCCESS: "logoutSuccess", // Used as magic string in logout-success.js
  REFRESH_TOKENS: "refreshTokens",
  // Needs to get epc image url in background and send to UI to stop CORS issues.
  FETCH_IMAGE_FOR_CANVAS: "fetchImageForCanvas",
  EPC_BANDS_READY: "epcBandsReady",
  PERFORM_OCR: "PERFORM_OCR",
  AUTHENTICATION_COMPLETE: "AUTHENTICATION_COMPLETE",
  LOGOUT_COMPLETE: "LOGOUT_COMPLETE",
  GET_AUTH_STATUS: "GET_AUTH_STATUS",
} as const;

export type ActionEvents = (typeof ActionEvents)[keyof typeof ActionEvents];
