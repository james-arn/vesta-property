export const capitaliseFirstLetterAndCleanString = (str: string) => {
  const cleanedString = str.replace(/[_-]/g, " ");
  return cleanedString.charAt(0).toUpperCase() + cleanedString.slice(1).toLowerCase();
};
