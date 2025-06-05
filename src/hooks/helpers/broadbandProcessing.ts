import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { UK_AVERAGE_BROADBAND_MBPS } from "@/constants/scoreConstants";
import { extractMbpsFromString } from "@/contentScript/utils/propertyScrapeHelpers";
import { BroadbandAvailability } from "@/types/premiumStreetData";
import { DataStatus } from "@/types/property";
import { getStatusFromString } from "@/utils/statusHelpers";

interface BroadbandScoreResult {
  scoreValue: number;
  status: DataStatus;
}

interface ProcessedBroadbandData {
  broadbandScoreValue: number;
  broadbandDisplayValue: string | null;
  broadbandStatus: DataStatus;
}

export function calculateBroadbandScore(speedMbps: number | null): BroadbandScoreResult {
  if (speedMbps === null) {
    return {
      scoreValue: 50, // Default score when no data
      status: DataStatus.ASK_AGENT,
    };
  }

  const percentageOfAverage = (speedMbps / UK_AVERAGE_BROADBAND_MBPS) * 100;
  let scoreValue: number;
  let status: DataStatus;

  if (percentageOfAverage < 50) {
    scoreValue = 20;
    status = DataStatus.ASK_AGENT;
  } else if (percentageOfAverage <= 90) {
    scoreValue = 40;
    status = DataStatus.FOUND_POSITIVE;
  } else if (percentageOfAverage <= 150) {
    scoreValue = 75;
    status = DataStatus.FOUND_POSITIVE;
  } else if (percentageOfAverage <= 500) {
    scoreValue = 90;
    status = DataStatus.FOUND_POSITIVE;
  } else {
    scoreValue = 100;
    status = DataStatus.FOUND_POSITIVE;
  }

  return { scoreValue, status };
}

function getBroadbandSpeedLabel(speedMbps: number | null): string | null {
  if (!speedMbps) {
    return null;
  }
  if (speedMbps >= 1000) {
    return `Gigabit ${speedMbps}Mbps`;
  } else if (speedMbps >= 100) {
    return `Ultrafast ${speedMbps}Mbps`;
  } else if (speedMbps >= 30) {
    return `Superfast ${speedMbps}Mbps`;
  } else if (speedMbps >= 10) {
    return `Average ${speedMbps}Mbps`;
  } else if (speedMbps >= 0) {
    return `Slow ${speedMbps}Mbps`;
  }
  return null;
}

export function processBroadbandData(
  scrapedBroadbandValue: string | null | undefined,
  premiumBroadbandData: BroadbandAvailability[] | null | undefined,
  isPremiumDataFetchedAndHasData: boolean
): ProcessedBroadbandData {
  if (isPremiumDataFetchedAndHasData && premiumBroadbandData) {
    const speedMbps =
      premiumBroadbandData?.find((type) => type.broadband_type === "Overall")
        ?.maximum_predicted_download_speed ?? null;

    const { scoreValue, status } = calculateBroadbandScore(speedMbps);
    const displayValue = getBroadbandSpeedLabel(speedMbps);

    return {
      broadbandScoreValue: scoreValue,
      broadbandDisplayValue: displayValue,
      broadbandStatus: status,
    };
  }

  // Fallback to scraped data
  if (scrapedBroadbandValue === CHECKLIST_NO_VALUE.NOT_MENTIONED) {
    return {
      broadbandScoreValue: 50, // Default score when no data
      broadbandDisplayValue: null,
      broadbandStatus: DataStatus.ASK_AGENT,
    };
  }

  const speedMbps = extractMbpsFromString(scrapedBroadbandValue ?? null);
  const displayValue = scrapedBroadbandValue ?? null;

  const { scoreValue, status } = calculateBroadbandScore(speedMbps);
  const initialStatus = getStatusFromString(scrapedBroadbandValue ?? null);
  const finalStatus = initialStatus === DataStatus.ASK_AGENT ? DataStatus.ASK_AGENT : status;

  return {
    broadbandScoreValue: scoreValue,
    broadbandDisplayValue: displayValue,
    broadbandStatus: finalStatus,
  };
}
