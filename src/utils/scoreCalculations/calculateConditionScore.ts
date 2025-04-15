import { CategoryScoreData, PropertyDataListItem } from "@/types/property";

export const calculateConditionScore = (
  items: PropertyDataListItem[]
): CategoryScoreData | undefined => {
  console.warn("Condition score calculation not implemented.");
  // TODO: Implement logic based on age, materials, EPC, known issues etc.
  // Placeholder: return a neutral score
  return {
    score: { scoreValue: 50, maxScore: 100, scoreLabel: "Medium Condition" },
    contributingItems: items,
  };
};
