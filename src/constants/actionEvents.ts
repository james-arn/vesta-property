export const ActionEvents = {
    UPDATE_PROPERTY_DATA: 'updatePropertyData',
    SHOW_WARNING: 'showWarning',
    TAB_CHANGED_OR_EXTENSION_OPENED: 'tabChangedOrExtensionOpened',
    SIDE_PANEL_OPENED: 'sidePanelOpened'
} as const;

export type ActionEvents = (typeof ActionEvents)[keyof typeof ActionEvents];