export function formatTimeInYearsMonthsWeeksDays(daysOnMarket: number): string {
  const years = Math.floor(daysOnMarket / 365);
  const months = Math.floor((daysOnMarket % 365) / 30);
  const weeks = Math.floor((daysOnMarket % 30) / 7);
  const days = Math.ceil(daysOnMarket % 7);

  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} year${years > 1 ? "s" : ""}`);
  }
  if (months > 0) {
    parts.push(`${months} month${months > 1 ? "s" : ""}`);
  }
  if (weeks > 0) {
    parts.push(`${weeks} week${weeks > 1 ? "s" : ""}`);
  }
  if (days > 0) {
    parts.push(`${days} day${days > 1 ? "s" : ""}`);
  }

  return parts.join(", ");
}

export const formatUnixTimestampToDateString = (timestamp: number | undefined | null): string => {
  if (!timestamp) {
    return "N/A";
  }
  // Convert Unix timestamp (seconds) to milliseconds
  const date = new Date(timestamp * 1000);
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  return new Intl.DateTimeFormat("en-GB", options).format(date);
};
