const GA_EVENT_NAMES = {
  FEEDBACK_SELECTED: "feedback_selected",
  EXTENSION_INSTALL: "extension_install",
  PROPERTY_ANALYSED: "property_analysed",
  UPGRADE_BUTTON_CLICKED: "upgrade_button_clicked",
  TOKEN_USED: "token_used",
};

export const GA_UPGRADE_BUTTON_LOCATIONS = {
  UPSELL_MODAL_UPGRADE_NOW: "upsell_modal_upgrade_now",
  SETTINGS_MENU_UPGRADE: "settings_menu_upgrade",
} as const;

export const DEFAULT_ENGAGEMENT_TIME_IN_MSEC = 100;
export const SESSION_EXPIRATION_IN_MIN = 30;

export default GA_EVENT_NAMES;
