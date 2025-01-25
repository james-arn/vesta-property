import { DataStatus, PropertyData, PropertyGroups } from '../types/property';

export function generatePropertyChecklist(extractedData: {
    price: string | null;
    location: string | null;
    bedrooms: string | null;
    bathrooms: string | null;
    images: string | null;
}): PropertyData[] {
    return [
        // General Property Information
        { group: PropertyGroups.GENERAL, label: "Price", key: "price", status: extractedData.price ? DataStatus.FOUND : DataStatus.MISSING, value: extractedData.price },
        { group: PropertyGroups.GENERAL, label: "Location", key: "location", status: extractedData.location ? DataStatus.FOUND : DataStatus.MISSING, value: extractedData.location },
        { group: PropertyGroups.GENERAL, label: "Property Type", key: "propertyType", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.GENERAL, label: "Tenure", key: "tenure", status: DataStatus.MISSING, value: null },

        // Interior Details
        { group: PropertyGroups.INTERIOR, label: "Bedrooms", key: "bedrooms", status: extractedData.bedrooms ? DataStatus.FOUND : DataStatus.MISSING, value: extractedData.bedrooms },
        { group: PropertyGroups.INTERIOR, label: "Bathrooms", key: "bathrooms", status: extractedData.bathrooms ? DataStatus.FOUND : DataStatus.MISSING, value: extractedData.bathrooms },
        { group: PropertyGroups.INTERIOR, label: "Living Spaces", key: "livingSpaces", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.INTERIOR, label: "Kitchen", key: "kitchen", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.INTERIOR, label: "Heating Type", key: "heatingType", status: DataStatus.MISSING, value: null },

        // Exterior Details
        { group: PropertyGroups.EXTERIOR, label: "Parking", key: "parking", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.EXTERIOR, label: "Garden", key: "garden", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.EXTERIOR, label: "Access", key: "access", status: DataStatus.MISSING, value: null },

        // Utilities and Services
        { group: PropertyGroups.UTILITIES, label: "EPC Rating", key: "epc", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.UTILITIES, label: "Council Tax Band", key: "councilTax", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.UTILITIES, label: "Broadband", key: "broadband", status: DataStatus.MISSING, value: null },

        // Neighbourhood and Environment
        { group: PropertyGroups.NEIGHBOURHOOD, label: "Noise Levels", key: "noiseLevels", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.NEIGHBOURHOOD, label: "Local Amenities", key: "localAmenities", status: DataStatus.MISSING, value: null },

        // Legal and Ownership
        { group: PropertyGroups.LEGAL, label: "Planning Permissions", key: "planningPermissions", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.LEGAL, label: "Ownership History", key: "ownershipHistory", status: DataStatus.MISSING, value: null },

        // Miscellaneous
        { group: PropertyGroups.MISC, label: "Floor Plan", key: "floorPlan", status: DataStatus.MISSING, value: null },
        { group: PropertyGroups.MISC, label: "Images", key: "images", status: extractedData.images ? DataStatus.FOUND : DataStatus.MISSING, value: extractedData.images },
    ];
}