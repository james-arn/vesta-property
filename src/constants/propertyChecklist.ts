import DOMPurify from 'dompurify';
import { DataStatus, ExtractedPropertyData, PropertyDataList, PropertyGroups } from '../types/property';

const agentMissingInfo = 'ask agent';

function getYesNoOrMissingStatus(value: string | null): DataStatus {
    if (!value || (typeof value === 'string' && value.toLowerCase() === agentMissingInfo)) {
        return DataStatus.MISSING;
    }
    return typeof value === 'string' && value.toLowerCase() === 'yes' ? DataStatus.FOUND_POSITIVE : DataStatus.FOUND_NEGATIVE;
}

export function generatePropertyChecklist(extractedData: ExtractedPropertyData): PropertyDataList[] {

    return [
        // General Property Information
        { group: PropertyGroups.GENERAL, label: "Price", key: "price", status: extractedData.price ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.price },
        { group: PropertyGroups.GENERAL, label: "Location", key: "location", status: extractedData.location ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.location },
        { group: PropertyGroups.GENERAL, label: "Property Type", key: "propertyType", status: extractedData.propertyType ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.propertyType },
        { group: PropertyGroups.GENERAL, label: "Tenure", key: "tenure", status: extractedData.tenure ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.tenure },
        { group: PropertyGroups.GENERAL, label: "Lising history", key: "listingHistory", status: extractedData.listingHistory ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.listingHistory },

        // Interior Details
        { group: PropertyGroups.INTERIOR, label: "Bedrooms", key: "bedrooms", status: extractedData.bedrooms ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.bedrooms },
        { group: PropertyGroups.INTERIOR, label: "Bathrooms", key: "bathrooms", status: extractedData.bathrooms ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.bathrooms },
        { group: PropertyGroups.INTERIOR, label: "Heating Type", key: "heatingType", status: typeof extractedData.heating === 'string' && extractedData.heating.toLowerCase() !== agentMissingInfo ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.heating },
        { group: PropertyGroups.INTERIOR, label: "Size", key: "size", status: typeof extractedData.size === 'string' && extractedData.size.toLowerCase() !== agentMissingInfo ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.size },
        { group: PropertyGroups.INTERIOR, label: "Floor Plan", key: "floorPlan", status: extractedData.floorPlan ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: DOMPurify.sanitize(extractedData.floorPlan ?? '') },

        // Exterior Details 
        { group: PropertyGroups.EXTERIOR, label: "Parking", key: "parking", status: getYesNoOrMissingStatus(extractedData.parking), value: extractedData.parking },
        { group: PropertyGroups.EXTERIOR, label: "Garden", key: "garden", status: getYesNoOrMissingStatus(extractedData.garden), value: extractedData.garden },
        { group: PropertyGroups.EXTERIOR, label: "Windows", key: "windows", status: typeof extractedData.windows === 'string' && extractedData.windows.toLowerCase() !== agentMissingInfo ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.windows },

        // Utilities and Services
        { group: PropertyGroups.UTILITIES, label: "EPC Certificate", key: "epc", status: extractedData.epc ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: DOMPurify.sanitize(extractedData.epc ?? '') },
        {
            group: PropertyGroups.UTILITIES,
            label: "Council Tax Band",
            key: "councilTax",
            status: extractedData.councilTax && (extractedData.councilTax !== agentMissingInfo && extractedData.councilTax?.toLowerCase() !== 'tbc') ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING,
            value: extractedData.councilTax
        },
        { group: PropertyGroups.UTILITIES, label: "Broadband", key: "broadband", status: extractedData.broadband ? DataStatus.FOUND_POSITIVE : DataStatus.MISSING, value: extractedData.broadband },

        // Neighbourhood and Environment
        { group: PropertyGroups.NEIGHBOURHOOD, label: "Noise Levels", key: "noiseLevels", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.NEIGHBOURHOOD, label: "Local Amenities", key: "localAmenities", status: DataStatus.MISSING, value: null },

        // Legal and Ownership
        { group: PropertyGroups.LEGAL, label: "Planning Permissions", key: "planningPermissions", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.LEGAL, label: "Ownership History", key: "ownershipHistory", status: DataStatus.MISSING, value: null },

    ];
}