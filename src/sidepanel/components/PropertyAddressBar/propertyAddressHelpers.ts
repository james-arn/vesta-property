import { Confidence, ConfidenceLevels, EpcDataSourceType } from "@/types/property";

export const getHighConfidenceAddressTooltipText = (
  confidence: Confidence,
  epcSource?: EpcDataSourceType | null
): string => {
  switch (confidence) {
    case ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED:
      // This covers scenarios where the address was confirmed directly on the GOV register
      // OR where a file EPC match with the GOV register confirmed the address.
      return "Address verified with the GOV.UK find my EPC service.";
    case ConfidenceLevels.HIGH:
      if (epcSource === EpcDataSourceType.GOV_EPC_SERVICE_AND_OCR_FILE_EPC_MATCH) {
        return "Address verified by matching the property EPC against the GOV.UK EPC find my EPC service.";
      }
      // Consider passing addressSource if you want to be more specific here, e.g., if HIGH is due to HOUSE_PRICES_PAGE_MATCH
      return "Address confidence is high based on available data.";
    case ConfidenceLevels.USER_PROVIDED:
      return "Address provided by user.";
    default:
      return "Address confidence: High"; // Fallback, should ideally not be hit if logic is correct
  }
};

export const getMediumConfidenceAddressTooltipUpdate = (
  epcSource?: EpcDataSourceType | null
): string => {
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
