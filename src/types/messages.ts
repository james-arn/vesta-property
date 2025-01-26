import { ActionEvents } from '../constants/actionEvents';

export interface SidePanelOpenedMessage {
    action: typeof ActionEvents.SIDE_PANEL_OPENED;
}

export interface ShowWarningMessage {
    action: typeof ActionEvents.SHOW_WARNING;
    message: string;
}

export interface UpdatePropertyDataMessage {
    action: typeof ActionEvents.UPDATE_PROPERTY_DATA;
    data: any;
}

export interface TabChangedOrExtensionOpenedMessage {
    action: typeof ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED;
    url: string;
}

export interface ResponseType {
    status: string;
}
