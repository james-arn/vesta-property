type DebouncedFunction<T extends (...args: any[]) => void> = (...args: Parameters<T>) => void;

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait = 2000
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}
