import { DataStatus, PropertyData, PropertyGroups } from '../types/property';

export const propertyChecklist: PropertyData[] = [
    // General Property Information
    { group: PropertyGroups.GENERAL, label: "Price", key: "price", status: DataStatus.FOUND, value: "£350,000" },
    { group: PropertyGroups.GENERAL, label: "Location", key: "location", status: DataStatus.FOUND, value: "Manchester, M20" },
    { group: PropertyGroups.GENERAL, label: "Property Type", key: "propertyType", status: DataStatus.FOUND, value: "Semi-Detached" },
    { group: PropertyGroups.GENERAL, label: "Tenure", key: "tenure", status: DataStatus.MISSING, value: null },

    // Interior Details
    { group: PropertyGroups.INTERIOR, label: "Bedrooms", key: "bedrooms", status: DataStatus.FOUND, value: 3 },
    { group: PropertyGroups.INTERIOR, label: "Bathrooms", key: "bathrooms", status: DataStatus.FOUND, value: 2 },
    { group: PropertyGroups.INTERIOR, label: "Living Spaces", key: "livingSpaces", status: DataStatus.PARTIAL, value: "1 lounge, 1 dining room" },
    { group: PropertyGroups.INTERIOR, label: "Kitchen", key: "kitchen", status: DataStatus.PARTIAL, value: "Modern with integrated appliances" },
    { group: PropertyGroups.INTERIOR, label: "Heating Type", key: "heatingType", status: DataStatus.MISSING, value: null },

    // Exterior Details
    { group: PropertyGroups.EXTERIOR, label: "Parking", key: "parking", status: DataStatus.FOUND, value: "On-street permit parking" },
    { group: PropertyGroups.EXTERIOR, label: "Garden", key: "garden", status: DataStatus.FOUND, value: "Private south-facing garden" },
    { group: PropertyGroups.EXTERIOR, label: "Access", key: "access", status: DataStatus.MISSING, value: null },

    // Utilities and Services
    { group: PropertyGroups.UTILITIES, label: "EPC Rating", key: "epc", status: DataStatus.MISSING, value: null },
    { group: PropertyGroups.UTILITIES, label: "Council Tax Band", key: "councilTax", status: DataStatus.MISSING, value: null },
    { group: PropertyGroups.UTILITIES, label: "Broadband", key: "broadband", status: DataStatus.MISSING, value: null },

    // Neighbourhood and Environment
    { group: PropertyGroups.NEIGHBOURHOOD, label: "Noise Levels", key: "noiseLevels", status: DataStatus.MISSING, value: null },
    { group: PropertyGroups.NEIGHBOURHOOD, label: "Local Amenities", key: "localAmenities", status: DataStatus.FOUND, value: "Schools, shops, GP nearby" },

    // Legal and Ownership
    { group: PropertyGroups.LEGAL, label: "Planning Permissions", key: "planningPermissions", status: DataStatus.MISSING, value: null },
    { group: PropertyGroups.LEGAL, label: "Ownership History", key: "ownershipHistory", status: DataStatus.MISSING, value: null },

    // Miscellaneous
    { group: PropertyGroups.MISC, label: "Floor Plan", key: "floorPlan", status: DataStatus.MISSING, value: null },
    { group: PropertyGroups.MISC, label: "Images", key: "images", status: DataStatus.FOUND, value: "8 photos" },
];
