export const ActionEvents = {
  PAGE_MODEL_AVAILABLE: "pageModelAvailable", // note- used as magic string in injectScript.js due to import syntax issues
  UPDATE_PROPERTY_DATA: "updatePropertyData",
  SHOW_WARNING: "showWarning",
  TAB_CHANGED_OR_EXTENSION_OPENED: "navigatedUrlOrTabChangedOrExtensionOpened",
  SIDE_PANEL_OPENED: "sidePanelOpened",
  FILL_RIGHTMOVE_CONTACT_FORM: "fillRightmoveContactForm",
  NAVIGATE_AND_SEND_DATA: "navigateAndSendData",
} as const;

export type ActionEvents = (typeof ActionEvents)[keyof typeof ActionEvents];
