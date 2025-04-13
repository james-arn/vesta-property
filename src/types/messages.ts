import { ActionEvents } from "../constants/actionEvents";

export interface MessageRequest {
  action: string;
  data?: any;
}

export interface SidePanelOpenedMessage extends MessageRequest {
  action: typeof ActionEvents.SIDE_PANEL_OPENED;
}

export interface ShowWarningMessage extends MessageRequest {
  action: typeof ActionEvents.SHOW_WARNING;
  data: string;
}

export interface UpdatePropertyDataMessage extends MessageRequest {
  action: typeof ActionEvents.PROPERTY_PAGE_OPENED;
  data: any;
}

export interface NavigatedUrlOrTabChangedOrExtensionOpenedMessage extends MessageRequest {
  action: typeof ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED;
  data: any;
}

export interface ResponseType {
  status: string;
}
