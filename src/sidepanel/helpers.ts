import { DataStatus } from '../types/property';

export const getStatusIcon = (status: DataStatus): string => {
    switch (status) {
        case DataStatus.FOUND_POSITIVE:
            return "✅";
        case DataStatus.FOUND_NEGATIVE:
            return "❌";
        case DataStatus.MISSING:
            return "⚠️";
    }
};

export const getStatusColor = (status: DataStatus): string => {
    switch (status) {
        case DataStatus.FOUND_POSITIVE:
            return "green";
        case DataStatus.FOUND_NEGATIVE:
            return "red";
        case DataStatus.MISSING:
            return "orange";
    }
}; 