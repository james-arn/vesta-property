import { ConfidenceLevels, EpcData, ExtractedPropertyScrapingData } from "@/types/property";

export enum PropertyReducerActionTypes {
  SET_FULL_PROPERTY_DATA = "SET_FULL_PROPERTY_DATA",
  UPDATE_DISPLAY_ADDRESS = "UPDATE_DISPLAY_ADDRESS",
  UPDATE_EPC_VALUE = "UPDATE_EPC_VALUE",
}

export type PropertyReducerAction =
  | {
      type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA;
      payload: ExtractedPropertyScrapingData;
    }
  | {
      type: PropertyReducerActionTypes.UPDATE_DISPLAY_ADDRESS;
      payload: { displayAddress: string; isAddressConfirmedByUser: boolean };
    }
  | {
      type: PropertyReducerActionTypes.UPDATE_EPC_VALUE;
      payload: { value: string };
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
    case PropertyReducerActionTypes.UPDATE_EPC_VALUE:
      return {
        ...state,
        epc: {
          ...(state.epc as EpcData),
          value: action.payload.value,
          confidence: ConfidenceLevels.USER_PROVIDED,
          error: null,
        },
      };
    default:
      return state;
  }
}

export { propertyReducer };
