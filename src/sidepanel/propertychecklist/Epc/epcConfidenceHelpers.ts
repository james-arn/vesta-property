import { Confidence, ConfidenceLevels, EpcDataSourceType } from "@/types/property";

export const getEpcConfidenceTooltipText = (
  confidence?: Confidence | null,
  epcSource?: EpcDataSourceType | null
): string => {
  if (!confidence) {
    return "EPC rating confidence is undetermined.";
  }

  switch (confidence) {
    case ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED:
      if (epcSource === EpcDataSourceType.GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS) {
        return "EPC Rating Confirmed: Verified directly with the official GOV.UK energy register based on address match.";
      } else if (epcSource === EpcDataSourceType.GOV_EPC_SERVICE_AND_OCR_FILE_EPC_MATCH) {
        return "EPC Rating Confirmed: Verified by matching property document EPC with the official GOV.UK energy register.";
      }
      // Fallback if the source doesn't give more specific context for this confidence level
      return "EPC Rating Confirmed: Verified with official GOV.UK energy register. Review EPC image if available.";

    case ConfidenceLevels.USER_PROVIDED:
      return "EPC rating provided by user.";

    case ConfidenceLevels.HIGH:
      // You might add more specific messages here based on epcSource if HIGH can come from various reliable sources
      return "EPC rating confidence is high. Review EPC image if available.";

    case ConfidenceLevels.MEDIUM:
      let mediumMessage = "EPC rating confidence is medium.";
      if (epcSource === EpcDataSourceType.PDF) {
        mediumMessage += " (Sourced from PDF document).";
      } else if (epcSource === EpcDataSourceType.IMAGE) {
        mediumMessage += " (Sourced from an image).";
      } else if (epcSource === EpcDataSourceType.LISTING) {
        mediumMessage += " (Sourced from property listing).";
      }
      mediumMessage += " Please double-check against EPC image.";
      return mediumMessage;

    case ConfidenceLevels.NONE:
    default:
      return "EPC rating confidence is low or undetermined. Please verify with EPC image.";
  }
};
