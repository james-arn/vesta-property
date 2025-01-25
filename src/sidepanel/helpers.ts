import { DataStatus } from '../types/property';

export const getStatusIcon = (status: DataStatus): string => {
    switch (status) {
        case DataStatus.FOUND:
            return "✅";
        case DataStatus.PARTIAL:
            return "⚠️";
        case DataStatus.MISSING:
            return "❌";
    }
};

export const getStatusColor = (status: DataStatus): string => {
    switch (status) {
        case DataStatus.FOUND:
            return "green";
        case DataStatus.PARTIAL:
            return "orange";
        case DataStatus.MISSING:
            return "red";
    }
}; 