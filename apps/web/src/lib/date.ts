import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfDay, subDays } from "date-fns";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Manila";

/** "Now", expressed in the single timezone the whole app reasons about. */
export function now(): TZDate {
  return TZDate.tz(APP_TIMEZONE);
}

/** Midnight at the start of the day `d` falls on, in the app timezone. */
export function startOfAppDay(d: Date = now()): Date {
  return startOfDay(new TZDate(d, APP_TIMEZONE));
}

/**
 * Half-open [start, end) bounds for a calendar day in the app timezone.
 * Every "due today" / "completed that day" comparison goes through this so the
 * seed, the queries and the UI can never disagree about where a day begins.
 */
export function dayRange(d: Date = now()): { start: Date; end: Date } {
  const start = startOfAppDay(d);
  return { start, end: addDays(start, 1) };
}

/** Half-open bounds covering `days` calendar days ending with the day of `d`. */
export function daysRange(days: number, d: Date = now()) {
  const { end } = dayRange(d);
  return { start: startOfAppDay(subDays(startOfAppDay(d), days - 1)), end };
}

/** The list of day-start instants for the last `days` days, oldest first. */
export function lastNDays(days: number, d: Date = now()): Date[] {
  const today = startOfAppDay(d);
  return Array.from({ length: days }, (_, i) =>
    startOfAppDay(subDays(today, days - 1 - i)),
  );
}

export function fmt(d: Date, pattern: string): string {
  return format(new TZDate(d, APP_TIMEZONE), pattern);
}

/** "Sunday, September 6" */
export const fmtLongDate = (d: Date) => fmt(d, "EEEE, MMMM d");

/** "2:00 PM" */
export const fmtTime = (d: Date) => fmt(d, "h:mm a");

export const fmtShortDay = (d: Date) => fmt(d, "EEE");

export const isSameAppDay = (a: Date, b: Date) =>
  startOfAppDay(a).getTime() === startOfAppDay(b).getTime();

/** Human due label relative to today: "Today, 2:00 PM" / "Sep 4, 9:00 AM". */
export function dueLabel(due: Date, reference: Date = now()): string {
  const today = startOfAppDay(reference);
  const day = startOfAppDay(due);
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return `Today, ${fmtTime(due)}`;
  if (diffDays === 1) return `Tomorrow, ${fmtTime(due)}`;
  if (diffDays === -1) return `Yesterday, ${fmtTime(due)}`;
  return `${fmt(due, "MMM d")}, ${fmtTime(due)}`;
}

/**
 * "just now" / "2h ago" / "Sep 6". Coarse on purpose: a feed wants to convey
 * recency, and a minute's precision on something from last week is noise.
 */
export function agoLabel(at: Date, reference: Date = now()): string {
  const seconds = Math.max(0, Math.round((reference.getTime() - at.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmt(at, "MMM d");
}

export function greeting(reference: Date = now()): string {
  const hour = Number(fmt(reference, "H"));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Percent as a whole number; 0 tasks due reads as 100% rather than NaN. */
export function pct(completed: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((completed / total) * 100);
}
