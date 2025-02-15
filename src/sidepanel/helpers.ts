import { DataStatus, PropertyDataList } from "../types/property";

export const getStatusIcon = (status: DataStatus): string => {
  switch (status) {
    case DataStatus.FOUND_POSITIVE:
      return "✅";
    case DataStatus.FOUND_NEGATIVE:
      return "❌";
    case DataStatus.ASK_AGENT:
      return "⚠️";
    case DataStatus.IS_LOADING:
      return "loading"; // this will show a loading spinner
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
    case DataStatus.IS_LOADING:
      return "gray";
  }
};

export const filterChecklistToAllAskAgentOnlyItems = (
  checklist: PropertyDataList[]
): PropertyDataList[] => {
  return checklist.filter((item) => item.status === DataStatus.ASK_AGENT);
};

export function extractPropertyIdFromUrl(url: string) {
  return url.match(/\/properties\/(\d+)/)?.[1];
}
