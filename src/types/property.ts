export enum DataStatus {
    FOUND = "FOUND",
    MISSING = "MISSING",
    PARTIAL = "PARTIAL"
}

export interface PropertyData {
    label: string;
    status: DataStatus;
    value: string | number | null;
    key: string;
    group: string;
}

export const PropertyGroups = {
    GENERAL: "General",
    INTERIOR: "Interior",
    EXTERIOR: "Exterior",
    UTILITIES: "Utilities",
    NEIGHBOURHOOD: "Neighbourhood",
    LEGAL: "Legal",
    RENTING: "Renting",
    MISC: "Miscellaneous"
} as const;
