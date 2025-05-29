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
  [ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED]: FaThumbsUp,
  [ConfidenceLevels.NONE]: null,
};

export const DISCLAIMER_TEXT = "Exact address based on agent's geolocation coordinates.";
export const EPC_SEARCH_BASE_URL =
  "https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=";

export const YOUTUBE_EXPLAINER_VIDEO_URL = "https://youtu.be/ixULj0-f6pU";

export const UNINSTALL_SURVEY_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSehDQZsICWQAS53uo7HGJIYh7w_NT9ex-TaIisdEOFnblLyyg/viewform?usp=header";
