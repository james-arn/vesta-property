import { ActionEvents } from "../constants/actionEvents";
import { PropertyDataList } from "./property";

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
  action: typeof ActionEvents.UPDATE_PROPERTY_DATA;
  data: any;
}

export interface TabChangedOrExtensionOpenedMessage extends MessageRequest {
  action: typeof ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED;
  data: string;
}

export interface FillRightmoveContactFormMessage extends MessageRequest {
  action: typeof ActionEvents.FILL_RIGHTMOVE_CONTACT_FORM;
  data: {
    selectedWarningItems: PropertyDataList[];
    emailAgentUrl: string;
  };
}

export interface ResponseType {
  status: string;
}
