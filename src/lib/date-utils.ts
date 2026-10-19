import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
} from "date-fns";

/**
 * Format a Date or date string to YYYY-MM-DD
 */
export function toDateString(date: Date | string): string {
  if (typeof date === "string") {
    // If already in YYYY-MM-DD format, return the first 10 chars
    return date.substring(0, 10);
  }
  return format(date, "yyyy-MM-dd");
}

/**
 * Parses YYYY-MM-DD string into a Date object representing UTC midnight of that date
 */
export function parseDateString(dateStr: string): Date {
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month, day, 0, 0, 0));
}

/**
 * Formats task timing for display:
 * - All day: "All day"
 * - Start only: "10:00"
 * - Range: "10:00 – 11:30"
 */
export function formatTaskTiming(startTime?: string | null, endTime?: string | null): string {
  if (!startTime) return "All day";
  if (!endTime) return startTime;
  return `${startTime} – ${endTime}`;
}

/**
 * Gets calendar days for month view (including padded days from prev/next months for standard 7-col grid)
 */
export function getMonthDays(currentDate: Date) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  return eachDayOfInterval({ start: startDate, end: endDate });
}

/**
 * Gets the 7 days of the current week
 */
export function getWeekDays(currentDate: Date) {
  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
  const endDate = endOfWeek(currentDate, { weekStartsOn: 0 });

  return eachDayOfInterval({ start: startDate, end: endDate });
}

export {
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
};
