import { CATEGORY_ITEM_MAP, DashboardScoreCategory } from "@/constants/dashboardConsts";
import {
  CategoryScoreData,
  DashboardScore,
  PreprocessedData,
  PropertyDataListItem,
} from "@/types/property";
import {
  findItemValue,
  getConditionScoreLabel,
  mapAgeBandToModifier,
  mapEpcRatingToScore,
  mapFloorMaterialToModifier,
  mapHeatingTypeToModifier,
  mapRoofMaterialToModifier,
  mapWallMaterialToModifier,
  mapWindowsToModifier,
} from "./helpers/conditionProcessingHelpers";

// Define a potential structure for constructionMaterials value
interface ConstructionMaterials {
  floor?: string;
  roof?: string;
  walls?: string;
}

export const calculateConditionScore = (
  items: PropertyDataListItem[],
  preprocessedData: PreprocessedData
): CategoryScoreData | undefined => {
  const contributingFactorKeys = CATEGORY_ITEM_MAP[DashboardScoreCategory.CONDITION] || [];
  const relevantItems = items.filter((item) => contributingFactorKeys.includes(item.key));

  // Find relevant values using helper
  const epcRating = findItemValue<string>(relevantItems, "epc");
  const ageBand = findItemValue<string>(relevantItems, "constructionAgeBand");
  const heatingValue = findItemValue<string>(relevantItems, "heatingType");
  const windowsValue = findItemValue<string>(relevantItems, "windows");
  const constructionMaterials = findItemValue<ConstructionMaterials>(
    relevantItems,
    "constructionMaterials"
  );
  const floorValue = constructionMaterials?.floor;
  const roofValue = constructionMaterials?.roof;
  const wallValue = constructionMaterials?.walls;

  const epcScoreFromPreprocessed = preprocessedData.epcScoreForCalculation;

  // Check if calculable
  const canCalculate = relevantItems.length > 0 || epcRating || epcScoreFromPreprocessed !== null;
  if (!canCalculate) {
    return undefined;
  }

  // Calculate Score Components
  const BASE_SCORE = 50;
  const scoreComponents: { value: number; description: string }[] = [];
  const warnings: string[] = [];

  // --- Scoring Components ---

  // 1. EPC Component (logic unchanged)
  let epcComponentValue = 0;
  let epcDescription = "";
  if (epcRating) {
    const mappedEpcScore = mapEpcRatingToScore(epcRating);
    epcComponentValue = BASE_SCORE * 0.5 + mappedEpcScore * 0.5 - BASE_SCORE;
    epcDescription = `EPC Rating: ${epcRating} (Mapped Score: ${mappedEpcScore.toFixed(0)}, Adjustment: ${epcComponentValue.toFixed(1)})`;
  } else if (epcScoreFromPreprocessed !== null) {
    const contribution = Math.max(0, Math.min(100, epcScoreFromPreprocessed));
    epcComponentValue = BASE_SCORE * 0.5 + contribution * 0.5 - BASE_SCORE;
    epcDescription = `EPC Score (Preprocessed): ${epcScoreFromPreprocessed} (Contribution: ${contribution.toFixed(0)}, Adjustment: ${epcComponentValue.toFixed(1)})`;
  } else {
    epcComponentValue = -5;
    epcDescription = "EPC Rating/Score: Missing (-5 penalty)";
    warnings.push("EPC information is missing, which impacts the Condition score accuracy.");
  }
  scoreComponents.push({ value: epcComponentValue, description: epcDescription });

  // 2. Age Band Component
  const ageBandModifier = mapAgeBandToModifier(ageBand);
  if (ageBand) {
    const ageBandDescription = `Construction Age: ${ageBand} (Modifier: ${ageBandModifier})`;
    scoreComponents.push({ value: ageBandModifier, description: ageBandDescription });
  } else {
    warnings.push(
      "Construction age is missing (potentially requires Premium), affecting score accuracy."
    );
  }

  // 3. Heating Component
  const heatingModifier = mapHeatingTypeToModifier(heatingValue);
  let heatingDescription = "";
  if (heatingValue) {
    heatingDescription = `Heating: ${heatingValue} (Modifier: ${heatingModifier})`;
    scoreComponents.push({ value: heatingModifier, description: heatingDescription });
  } else {
    heatingDescription = `Heating Type: Missing (Modifier: ${heatingModifier})`;
    scoreComponents.push({ value: heatingModifier, description: heatingDescription });
    warnings.push("Heating type information is missing.");
  }

  // 4. Windows Component
  const windowsModifier = mapWindowsToModifier(windowsValue);
  let windowsDescription = "";
  if (windowsValue) {
    windowsDescription = `Windows: ${windowsValue} (Modifier: ${windowsModifier})`;
    scoreComponents.push({ value: windowsModifier, description: windowsDescription });
  } else {
    windowsDescription = `Windows Type: Missing (Modifier: ${windowsModifier})`;
    scoreComponents.push({ value: windowsModifier, description: windowsDescription });
    warnings.push("Windows information is missing.");
  }

  // 5. Floor Material Component
  const floorModifier = mapFloorMaterialToModifier(floorValue);
  let floorDescription = "";
  if (floorValue) {
    floorDescription = `Floor Material: ${floorValue} (Modifier: ${floorModifier})`;
  } else {
    floorDescription = "Floor Material: Missing (Modifier: 0)";
    warnings.push("Floor material information is missing.");
  }
  scoreComponents.push({ value: floorModifier, description: floorDescription });

  // 6. Roof Material Component
  const roofModifier = mapRoofMaterialToModifier(roofValue);
  let roofDescription = "";
  if (roofValue) {
    roofDescription = `Roof Material: ${roofValue} (Modifier: ${roofModifier})`;
  } else {
    roofDescription = "Roof Material: Missing (Modifier: 0)";
    warnings.push("Roof material information is missing.");
  }
  scoreComponents.push({ value: roofModifier, description: roofDescription });

  // 7. Wall Material Component
  const wallModifier = mapWallMaterialToModifier(wallValue);
  let wallDescription = "";
  if (wallValue) {
    wallDescription = `Wall Material: ${wallValue} (Modifier: ${wallModifier})`;
  } else {
    wallDescription = "Wall Material: Missing (Modifier: 0)";
    warnings.push("Wall material information is missing.");
  }
  scoreComponents.push({ value: wallModifier, description: wallDescription });

  // --- Combine Components ---
  const totalScoreAdjustment = scoreComponents.reduce((sum, comp) => sum + comp.value, 0);
  const calculatedScore = BASE_SCORE + totalScoreAdjustment;
  const finalScoreValue = Math.max(0, Math.min(100, Math.round(calculatedScore)));

  // --- Determine Score Label using helper ---
  const scoreLabel = getConditionScoreLabel(finalScoreValue);

  const finalScore: DashboardScore = {
    scoreValue: finalScoreValue,
    maxScore: 100,
    scoreLabel: scoreLabel,
  };

  const finalWarningMessage = warnings.length > 0 ? warnings.join(" ") : undefined;

  return {
    score: finalScore,
    contributingItems: relevantItems,
    warningMessage: finalWarningMessage,
  };
};
