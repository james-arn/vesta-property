export const ActionEvents = {
  PAGE_MODEL_AVAILABLE: "pageModelAvailable", // note- used as magic string in injectScript.js due to import syntax issues
  PROPERTY_PAGE_OPENED: "PROPERTY_PAGE_OPENED",
  SHOW_WARNING: "showWarning",
  TAB_CHANGED_OR_EXTENSION_OPENED: "navigatedUrlOrTabChangedOrExtensionOpened",
  SIDE_PANEL_OPENED: "sidePanelOpened", // This is likely sent BY the side panel itself when it loads/initializes
  REQUEST_OPEN_SIDE_PANEL: "requestOpenSidePanel", // Sent from content script button to request background to open panel
  REQUEST_SIDE_PANEL_CLOSE_ACTION: "requestSidePanelCloseAction", // From pull tab to background
  BACKGROUND_COMMANDS_SIDE_PANEL_CLOSE: "backgroundCommandsSidePanelClose", // From background to side panel UI
  SIDE_PANEL_IS_NOW_CLOSING: "sidePanelIsNowClosing", // From side panel UI to content script
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
  // Address Lookup Actions
  REQUEST_ADDRESS_LOOKUP: "REQUEST_ADDRESS_LOOKUP",
  ADDRESS_LOOKUP_RESULT: "ADDRESS_LOOKUP_RESULT",
  CONTENT_SCRIPT_PROPERTY_DATA_EXTRACTED: "CONTENT_SCRIPT_PROPERTY_DATA_EXTRACTED",
  // Events for PDF OCR via Offscreen Document
  BACKGROUND_REQUEST_PDF_OCR: "BACKGROUND_REQUEST_PDF_OCR",
  OFFSCREEN_PDF_OCR_RESULT: "OFFSCREEN_PDF_OCR_RESULT",
  GET_PROPERTY_DATA_FROM_CACHE: "GET_PROPERTY_DATA_FROM_CACHE",
  BACKGROUND_REQUESTS_CLIENT_PDF_OCR: "BACKGROUND_REQUESTS_CLIENT_PDF_OCR",
  CLIENT_PDF_OCR_RESULT: "CLIENT_PDF_OCR_RESULT",
} as const;

export type ActionEvents = (typeof ActionEvents)[keyof typeof ActionEvents];
