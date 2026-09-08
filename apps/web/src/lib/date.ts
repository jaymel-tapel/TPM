import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfDay, subDays } from "date-fns";

/**
 * The department's timezone — the fallback, not the law.
 *
 * A person may set their own, and when they do it decides where *their* day
 * begins and ends: what "due today" counts, what is overdue, and whether
 * something was finished on time. Everything below therefore takes a zone, and
 * defaults to this only when nobody has said otherwise.
 *
 * The consequence is worth stating rather than discovering: two people in
 * different zones can honestly disagree about whether the same task was late.
 * A day boundary is a property of who is reading, not of the row.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/London";

/** A named IANA zone. Aliased so a bare string is harder to pass by accident. */
export type Zone = string;

/**
 * Whose day this is. Null on a user means the department's, and the
 * department's is itself a setting — passing it in keeps this pure.
 */
export const zoneOf = (
  user: { timezone: string | null } | null | undefined,
  fallback: Zone = APP_TIMEZONE,
): Zone => user?.timezone || fallback;

/** "Now". The instant is the same everywhere; the zone decides how it reads. */
export function now(zone: Zone = APP_TIMEZONE): TZDate {
  return TZDate.tz(zone);
}

/** Midnight at the start of the day `d` falls on, in `zone`. */
export function startOfAppDay(d: Date = now(), zone: Zone = APP_TIMEZONE): Date {
  return startOfDay(new TZDate(d, zone));
}

/**
 * Half-open [start, end) bounds for a calendar day.
 * Every "due today" / "completed that day" comparison goes through this so the
 * seed, the queries and the UI can never disagree about where a day begins.
 */
export function dayRange(
  d: Date = now(),
  zone: Zone = APP_TIMEZONE,
): { start: Date; end: Date } {
  const start = startOfAppDay(d, zone);
  return { start, end: addDays(start, 1) };
}

/** Half-open bounds covering `days` calendar days ending with the day of `d`. */
export function daysRange(days: number, d: Date = now(), zone: Zone = APP_TIMEZONE) {
  const { end } = dayRange(d, zone);
  return {
    start: startOfAppDay(subDays(startOfAppDay(d, zone), days - 1), zone),
    end,
  };
}

/** The list of day-start instants for the last `days` days, oldest first. */
export function lastNDays(days: number, d: Date = now(), zone: Zone = APP_TIMEZONE): Date[] {
  const today = startOfAppDay(d, zone);
  return Array.from({ length: days }, (_, i) =>
    startOfAppDay(subDays(today, days - 1 - i), zone),
  );
}

export function fmt(d: Date, pattern: string, zone: Zone = APP_TIMEZONE): string {
  return format(new TZDate(d, zone), pattern);
}

/** "Sunday, September 6" */
export const fmtLongDate = (d: Date, zone?: Zone) => fmt(d, "EEEE, MMMM d", zone);

/** "2:00 PM" */
export const fmtTime = (d: Date, zone?: Zone) => fmt(d, "h:mm a", zone);

export const fmtShortDay = (d: Date, zone?: Zone) => fmt(d, "EEE", zone);

export const isSameAppDay = (a: Date, b: Date, zone?: Zone) =>
  startOfAppDay(a, zone).getTime() === startOfAppDay(b, zone).getTime();

/** Human due label relative to today: "Today, 2:00 PM" / "Sep 4, 9:00 AM". */
export function dueLabel(
  due: Date,
  reference: Date = now(),
  zone: Zone = APP_TIMEZONE,
): string {
  const today = startOfAppDay(reference, zone);
  const day = startOfAppDay(due, zone);
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return `Today, ${fmtTime(due, zone)}`;
  if (diffDays === 1) return `Tomorrow, ${fmtTime(due, zone)}`;
  if (diffDays === -1) return `Yesterday, ${fmtTime(due, zone)}`;
  return `${fmt(due, "MMM d", zone)}, ${fmtTime(due, zone)}`;
}

/**
 * "just now" / "2h ago" / "Sep 6". Coarse on purpose: a feed wants to convey
 * recency, and a minute's precision on something from last week is noise.
 *
 * Elapsed time needs no zone — only the date it falls back to does.
 */
export function agoLabel(at: Date, reference: Date = now(), zone?: Zone): string {
  const seconds = Math.max(0, Math.round((reference.getTime() - at.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmt(at, "MMM d", zone);
}

export function greeting(reference: Date = now(), zone?: Zone): string {
  const hour = Number(fmt(reference, "H", zone));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Percent as a whole number; 0 tasks due reads as 100% rather than NaN. */
export function pct(completed: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((completed / total) * 100);
}
