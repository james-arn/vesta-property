import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { DataStatus } from "@/types/property";

const agentMissingInfo = "";
const askAgentWrittenByAgent = "ask agent";

// Helper to determine status for a string-based property
export function getStatusFromString(
  value: string | null,
  additionalInvalids: string[] = []
): DataStatus {
  if (!value) return DataStatus.ASK_AGENT;
  const lowerValue = value.trim().toLowerCase();
  const invalidValues = [
    agentMissingInfo,
    askAgentWrittenByAgent,
    ...Object.values(CHECKLIST_NO_VALUE).map((value) => value.toLowerCase()),
    ...additionalInvalids,
  ];
  if (invalidValues.includes(lowerValue)) {
    return DataStatus.ASK_AGENT;
  }
  return DataStatus.FOUND_POSITIVE;
}
