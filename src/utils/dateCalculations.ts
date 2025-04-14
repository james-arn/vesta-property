import { differenceInMonths, differenceInYears } from "date-fns";

/**
 * Calculates the remaining lease term from an end date string.
 * @param endDateString The lease end date in 'YYYY-MM-DD' format.
 * @returns An object with formatted string and total months remaining, or nulls if invalid date.
 */
export const calculateRemainingLeaseTerm = (
  endDateString: string | null | undefined
): { formatted: string | null; totalMonths: number | null } => {
  if (!endDateString) {
    return { formatted: null, totalMonths: null };
  }

  try {
    const endDate = new Date(endDateString);
    const now = new Date();

    // Check if the end date is valid and in the future
    if (isNaN(endDate.getTime()) || endDate <= now) {
      return { formatted: endDate <= now ? "Expired" : null, totalMonths: 0 };
    }

    const years = differenceInYears(endDate, now);
    const months = differenceInMonths(endDate, now) % 12;
    const totalMonths = differenceInMonths(endDate, now);

    let formattedString = "";
    if (years > 0) {
      formattedString += `${years} year${years > 1 ? "s" : ""}`;
    }
    if (months > 0) {
      if (formattedString) formattedString += ", ";
      formattedString += `${months} month${months > 1 ? "s" : ""}`;
    }

    formattedString = formattedString
      ? `${formattedString} remaining`
      : "Less than a month remaining";

    return { formatted: formattedString, totalMonths: totalMonths };
  } catch (error) {
    console.error("Error calculating remaining lease term:", error);
    return { formatted: null, totalMonths: null };
  }
};
