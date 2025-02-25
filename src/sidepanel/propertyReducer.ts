import { ExtractedPropertyScrapingData } from "@/types/property";

export enum PropertyReducerActionTypes {
  SET_FULL_PROPERTY_DATA = "SET_FULL_PROPERTY_DATA",
  UPDATE_DISPLAY_ADDRESS = "UPDATE_DISPLAY_ADDRESS",
}

export type PropertyReducerAction =
  | {
      type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA;
      payload: ExtractedPropertyScrapingData;
    }
  | {
      type: PropertyReducerActionTypes.UPDATE_DISPLAY_ADDRESS;
      payload: { displayAddress: string; isAddressConfirmedByUser: boolean };
    };

function propertyReducer(
  state: ExtractedPropertyScrapingData,
  action: PropertyReducerAction
): ExtractedPropertyScrapingData {
  switch (action.type) {
    case PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA:
      return { ...action.payload };
    case PropertyReducerActionTypes.UPDATE_DISPLAY_ADDRESS:
      return {
        ...state,
        address: {
          ...state.address,
          displayAddress: action.payload.displayAddress,
          isAddressConfirmedByUser: action.payload.isAddressConfirmedByUser,
        },
      };
    default:
      return state;
  }
}

export { propertyReducer };
