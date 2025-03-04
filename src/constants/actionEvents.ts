export const ActionEvents = {
  PAGE_MODEL_AVAILABLE: "pageModelAvailable", // note- used as magic string in injectScript.js due to import syntax issues
  UPDATE_PROPERTY_DATA: "updatePropertyData",
  SHOW_WARNING: "showWarning",
  TAB_CHANGED_OR_EXTENSION_OPENED: "navigatedUrlOrTabChangedOrExtensionOpened",
  SIDE_PANEL_OPENED: "sidePanelOpened",
  FILL_RIGHTMOVE_CONTACT_FORM: "fillRightmoveContactForm",
  NAVIGATE_TO_CONTACT_AGENT_PAGE: "navigateToContactAgentPage",
  RIGHTMOVE_SIGN_IN_PAGE_OPENED: "rightmoveSignInPageOpened",
  RIGHTMOVE_SIGN_IN_COMPLETED: "rightmoveSignInCompleted",
  NAVIGATE_BACK_TO_PROPERTY_LISTING: "navigateBackToPropertyListing",
  AGENT_CONTACT_FORM_SUBMITTED: "agentContactFormSubmitted",
  // Authentication events
  AUTH_CODE_RECEIVED: "authCodeReceived",
  AUTH_TOKEN_EXCHANGE_SUCCESS: "authTokenExchangeSuccess",
  AUTH_TOKEN_EXCHANGE_FAILURE: "authTokenExchangeFailure",
  AUTH_SUCCESS: "authSuccess", // NOTE - used as magic string in login-success.html & logout-success.html as can't import constants into html files
  LOGOUT_SUCCESS: "logoutSuccess", // Used as magic string in logout-success.js
} as const;

export type ActionEvents = (typeof ActionEvents)[keyof typeof ActionEvents];
