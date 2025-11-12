export const cls = (...c) => c.filter(Boolean).join(" ");

export function timeAgo(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  
  // Handle invalid dates or future dates
  if (isNaN(diffMs) || diffMs < 0) {
    return "just now";
  }
  
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  
  // Define time ranges in seconds and their corresponding units
  const ranges = [
    { limit: 60, unit: "second", divisor: 1 },
    { limit: 3600, unit: "minute", divisor: 60 },
    { limit: 86400, unit: "hour", divisor: 3600 },
    { limit: 604800, unit: "day", divisor: 86400 },
    { limit: 2629800, unit: "week", divisor: 604800 },
    { limit: 31557600, unit: "month", divisor: 2629800 },
  ];
  
  // Find the appropriate range
  for (const range of ranges) {
    if (diffSec < range.limit) {
      const value = -Math.floor(diffSec / range.divisor);
      return rtf.format(value, /** @type {Intl.RelativeTimeFormatUnit} */ (range.unit));
    }
  }
  
  // For times longer than a year
  const years = -Math.floor(diffSec / 31557600);
  return rtf.format(years, "year");
}

export const makeId = (p) => `${p}${Math.random().toString(36).slice(2, 10)}`;
