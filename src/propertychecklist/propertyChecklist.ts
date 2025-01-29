import DOMPurify from 'dompurify';
import { DataStatus, ExtractedPropertyData, PropertyDataList, PropertyGroups } from '../types/property';
import { calculateListingHistoryDetails, getStatusFromBoolean, getYesNoOrAskAgentStringFromBoolean, getYesNoOrMissingStatus } from './helpers';

export const agentMissingInfo = 'ask agent';

export function generatePropertyChecklist(extractedData: ExtractedPropertyData): PropertyDataList[] {
    const { status: listingHistoryStatus, value: listingHistoryValue } = calculateListingHistoryDetails(extractedData.listingHistory);
    console.log('listingHistoryStatus:', listingHistoryStatus);
    console.log('listingHistoryValue:', listingHistoryValue);

    console.log('ext', extractedData.accessibility)
    return [
        // General Property Information
        { group: PropertyGroups.GENERAL, label: "Price", key: "price", status: extractedData.price ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.price },
        { group: PropertyGroups.GENERAL, label: "Location", key: "location", status: extractedData.location ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.location },
        { group: PropertyGroups.GENERAL, label: "Property Type", key: "propertyType", status: extractedData.propertyType ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.propertyType },
        { group: PropertyGroups.GENERAL, label: "Tenure", key: "tenure", status: extractedData.tenure ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.tenure },
        { group: PropertyGroups.GENERAL, label: "Listing history", key: "listingHistory", status: listingHistoryStatus, value: listingHistoryValue },
        { group: PropertyGroups.GENERAL, label: "Accessibility", key: "accessibility", status: extractedData.accessibility?.toLowerCase() !== agentMissingInfo ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.accessibility },

        // Interior Details
        { group: PropertyGroups.INTERIOR, label: "Bedrooms", key: "bedrooms", status: extractedData.bedrooms ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.bedrooms },
        { group: PropertyGroups.INTERIOR, label: "Bathrooms", key: "bathrooms", status: extractedData.bathrooms ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.bathrooms },
        { group: PropertyGroups.INTERIOR, label: "Heating Type", key: "heatingType", status: typeof extractedData.heating === 'string' && extractedData.heating.toLowerCase() !== agentMissingInfo ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.heating },
        { group: PropertyGroups.INTERIOR, label: "Size", key: "size", status: typeof extractedData.size === 'string' && extractedData.size.toLowerCase() !== agentMissingInfo ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.size },
        { group: PropertyGroups.INTERIOR, label: "Floor Plan", key: "floorPlan", status: extractedData.floorPlan ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: DOMPurify.sanitize(extractedData.floorPlan ?? '') },

        // Exterior Details 
        { group: PropertyGroups.EXTERIOR, label: "Parking", key: "parking", status: getYesNoOrMissingStatus(extractedData.parking), value: extractedData.parking ?? 'Ask agent' },
        { group: PropertyGroups.EXTERIOR, label: "Garden", key: "garden", status: getYesNoOrMissingStatus(extractedData.garden), value: extractedData.garden ?? 'Ask agent' },

        { group: PropertyGroups.EXTERIOR, label: "Windows", key: "windows", status: typeof extractedData.windows === 'string' && extractedData.windows.toLowerCase() !== agentMissingInfo ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.windows },
        // construction type of the property 

        // Utilities and Services
        { group: PropertyGroups.UTILITIES, label: "EPC Certificate", key: "epc", status: extractedData.epc ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: DOMPurify.sanitize(extractedData.epc ?? '') },
        {
            group: PropertyGroups.UTILITIES,
            label: "Council Tax Band",
            key: "councilTax",
            status: extractedData.councilTax && (extractedData.councilTax !== agentMissingInfo && extractedData.councilTax?.toLowerCase() !== 'tbc') ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT,
            value: extractedData.councilTax
        },
        { group: PropertyGroups.UTILITIES, label: "Broadband", key: "broadband", status: extractedData.broadband ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT, value: extractedData.broadband },

        // Rights and Restrictions
        { group: PropertyGroups.RIGHTS_AND_RESTRICTIONS, label: "Public right of way obligation", key: "publicRightOfWayObligation", status: getStatusFromBoolean(extractedData.publicRightOfWayObligation, true), value: getYesNoOrAskAgentStringFromBoolean(extractedData.publicRightOfWayObligation) },
        { group: PropertyGroups.RIGHTS_AND_RESTRICTIONS, label: "Private right of way obligation", key: "privateRightOfWayObligation", status: getStatusFromBoolean(extractedData.privateRightOfWayObligation, true), value: getYesNoOrAskAgentStringFromBoolean(extractedData.privateRightOfWayObligation) },
        { group: PropertyGroups.RIGHTS_AND_RESTRICTIONS, label: "Listed property", key: "listedProperty", status: getStatusFromBoolean(extractedData.listedProperty, true), value: getYesNoOrAskAgentStringFromBoolean(extractedData.listedProperty) },

        { group: PropertyGroups.RIGHTS_AND_RESTRICTIONS, label: "Restrictions", key: "restrictions", status: getStatusFromBoolean(extractedData.restrictions, true), value: getYesNoOrAskAgentStringFromBoolean(extractedData.restrictions) },

        { group: PropertyGroups.RISKS, label: "Flood Defences", key: "floodDefences", status: getStatusFromBoolean(extractedData.floodDefences), value: getYesNoOrAskAgentStringFromBoolean(extractedData.floodDefences) },
        {
            group: PropertyGroups.RISKS, label: "Flood Sources", key: "floodSources",
            status: (extractedData.floodSources ?? []).length > 0 ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT,
            value: (extractedData.floodSources ?? []).length > 0 ? extractedData.floodSources?.join(', ') ?? 'Ask agent' : 'Ask agent'
        },

        { group: PropertyGroups.RISKS, label: "Flooded in last 5 years", key: "floodedInLastFiveYears", status: getStatusFromBoolean(extractedData.floodedInLastFiveYears, true), value: getYesNoOrAskAgentStringFromBoolean(extractedData.floodedInLastFiveYears) },
        // building safety
        // coastal erosion
        // impact of mining in the area

        // TODO: ON ROADMAP...
        // // Neighbourhood and Environment
        // { group: PropertyGroups.NEIGHBOURHOOD, label: "Noise Levels", key: "noiseLevels", status: DataStatus.ASK_AGENT, value: null },
        // { group: PropertyGroups.NEIGHBOURHOOD, label: "Local Amenities", key: "localAmenities", status: DataStatus.ASK_AGENT, value: null },

        // // Legal and Ownership
        // { group: PropertyGroups.LEGAL, label: "Planning Permissions", key: "planningPermissions", status: DataStatus.ASK_AGENT, value: null },
        // { group: PropertyGroups.LEGAL, label: "Ownership History", key: "ownershipHistory", status: DataStatus.ASK_AGENT, value: null },

    ];
}