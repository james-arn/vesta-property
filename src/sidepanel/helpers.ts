import { DataStatus, PropertyDataList } from '../types/property';

export const getStatusIcon = (status: DataStatus): string => {
    switch (status) {
        case DataStatus.FOUND_POSITIVE:
            return "✅";
        case DataStatus.FOUND_NEGATIVE:
            return "❌";
        case DataStatus.ASK_AGENT:
            return "⚠️";
    }
};

export const getStatusColor = (status: DataStatus): string => {
    switch (status) {
        case DataStatus.FOUND_POSITIVE:
            return "green";
        case DataStatus.FOUND_NEGATIVE:
            return "red";
        case DataStatus.ASK_AGENT:
            return "orange";
    }
};

export const filterChecklistToAllAskAgentOnlyItems = (checklist: PropertyDataList[]): PropertyDataList[] => {
    return checklist.filter(item => item.status === DataStatus.ASK_AGENT);
};