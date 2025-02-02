export const ActionEvents = {
  UPDATE_PROPERTY_DATA: "updatePropertyData",
  SHOW_WARNING: "showWarning",
  TAB_CHANGED_OR_EXTENSION_OPENED: "tabChangedOrExtensionOpened",
  SIDE_PANEL_OPENED: "sidePanelOpened",
  FILL_RIGHTMOVE_CONTACT_FORM: "fillRightmoveContactForm",
  PAGE_MODEL_AVAILABLE: "pageModelAvailable", // note- used as magic string in injectScript.js due to import syntax issues
} as const;

export type ActionEvents = (typeof ActionEvents)[keyof typeof ActionEvents];
