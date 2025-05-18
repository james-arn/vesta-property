import { Confidence, ConfidenceLevels, EpcDataSourceType } from "@/types/property";

export const getHighConfidenceTooltipText = (
  confidence: Confidence,
  epcSource?: EpcDataSourceType | null
): string => {
  switch (confidence) {
    case ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED:
      // This covers scenarios where the address was confirmed directly on the GOV register
      // OR where a file EPC match with the GOV register confirmed the address.
      return "Address confirmed: Verified with the official GOV.UK energy register.";
    case ConfidenceLevels.HIGH:
      if (epcSource === EpcDataSourceType.GOV_EPC_SERVICE_AND_OCR_FILE_EPC_MATCH) {
        return "Address highly accurate: Verified by matching property document EPC with the official GOV.UK energy register.";
      }
      // Consider passing addressSource if you want to be more specific here, e.g., if HIGH is due to HOUSE_PRICES_PAGE_MATCH
      return "Address confidence is high based on available data.";
    case ConfidenceLevels.USER_PROVIDED:
      return "Address provided by user.";
    default:
      return "Address confidence: High"; // Fallback, should ideally not be hit if logic is correct
  }
};

export const getMediumConfidenceTooltipUpdate = (epcSource?: EpcDataSourceType | null): string => {
  if (!epcSource) return "";

  switch (epcSource) {
    case EpcDataSourceType.PDF:
      return " (EPC data from a PDF document was considered in this assessment).";
    case EpcDataSourceType.IMAGE:
      return " (EPC data from an image was considered in this assessment).";
    case EpcDataSourceType.LISTING:
      return " (EPC data from the property listing was considered in this assessment).";
    // Other EpcDataSourceTypes (USER_PROVIDED, GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS,
    // GOV_EPC_SERVICE_AND_OCR_FILE_EPC_MATCH, PREMIUM_API) typically lead to
    // higher than Medium confidence for the address if they influence it.
    // If they were somehow associated with a Medium address confidence, a generic message is better than the raw enum.
    default:
      return " (Related EPC data was also considered).";
  }
};
