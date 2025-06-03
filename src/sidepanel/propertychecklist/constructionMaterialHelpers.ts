import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";

export const getConstructionMaterialValue = (constructionMaterials: {
  floor?: string | null;
  walls?: string | null;
  roof?: string | null;
  windows?: string | null;
}): string => {
  const { floor, walls, roof, windows } = constructionMaterials;

  // Check if all materials are undefined or null
  const allMaterialsUnavailable = [floor, walls, roof, windows].every(
    (material) => material === null || material === undefined
  );

  if (allMaterialsUnavailable) {
    return CHECKLIST_NO_VALUE.NOT_AVAILABLE;
  }

  // Create a list of all materials, marking undefined/null as NOT_AVAILABLE
  const materialsList = [
    `Floor: ${floor ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE}`,
    `Walls: ${walls ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE}`,
    `Roof: ${roof ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE}`,
    `Windows: ${windows ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE}`,
  ];

  return materialsList.join(", ");
};
