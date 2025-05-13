import { ConfidenceLevels } from "@/types/property";
import React from "react";
import { FaExclamationTriangle, FaThumbsUp, FaUserEdit } from "react-icons/fa";

export const confidenceIcons: Record<
  (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels],
  React.ElementType | null
> = {
  [ConfidenceLevels.HIGH]: FaThumbsUp,
  [ConfidenceLevels.MEDIUM]: FaExclamationTriangle,
  [ConfidenceLevels.USER_PROVIDED]: FaUserEdit,
  [ConfidenceLevels.CONFIRMED_BY_GOV_EPC]: FaThumbsUp,
  [ConfidenceLevels.NONE]: null,
};
