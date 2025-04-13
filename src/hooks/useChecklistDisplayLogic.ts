import { filterChecklistToAllAskAgentOnlyItems } from "@/sidepanel/helpers";
import { PropertyDataListItem } from "@/types/property";
import { useCallback, useMemo, useState } from "react";

interface ChecklistFilters {
  showAskAgentOnly: boolean;
  // Add other potential filters here
}

interface UseChecklistDisplayLogicResult {
  filters: ChecklistFilters;
  openGroups: Record<string, boolean>;
  filteredChecklistData: PropertyDataListItem[];
  toggleFilter: (filterName: keyof ChecklistFilters) => void;
  toggleGroup: (group: string) => void;
  setOpenGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; // Expose setter if needed externally
}

export const useChecklistDisplayLogic = (
  basePropertyChecklistData: PropertyDataListItem[]
): UseChecklistDisplayLogicResult => {
  const [filters, setFilters] = useState<ChecklistFilters>({
    showAskAgentOnly: false,
  });

  const initialOpenGroups = useMemo(() => {
    return basePropertyChecklistData.reduce(
      (acc: Record<string, boolean>, item: PropertyDataListItem) => {
        if (item.checklistGroup) {
          acc[item.checklistGroup] = true;
        }
        return acc;
      },
      {} as Record<string, boolean>
    );
  }, [basePropertyChecklistData]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpenGroups);
  const toggleFilter = useCallback((filterName: keyof ChecklistFilters) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  }, []);

  const applyFilters = useCallback(
    (
      checklist: PropertyDataListItem[],
      currentFilters: ChecklistFilters
    ): PropertyDataListItem[] => {
      let filteredList = [...checklist];
      if (currentFilters.showAskAgentOnly) {
        filteredList = filterChecklistToAllAskAgentOnlyItems(filteredList);
      }
      // Add other filter logic here
      return filteredList;
    },
    [] // Dependencies: functions used inside like filterChecklistToAllAskAgentOnlyItems if they aren't stable
  );

  const filteredChecklistData = useMemo(
    () => applyFilters(basePropertyChecklistData, filters),
    [basePropertyChecklistData, filters, applyFilters]
  );

  return {
    filters,
    openGroups,
    filteredChecklistData,
    toggleFilter,
    toggleGroup,
    setOpenGroups,
  };
};
