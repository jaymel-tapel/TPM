import { APP_TIMEZONE } from "@/lib/date";
import type { LeaveHalf } from "@/db/schema";

/**
 * Everything about how a range of leave is counted and written down.
 *
 * One module, no clock and no database, so the action that validates a
 * request, the query that decides who is away and the presenter that labels a
 * row cannot quietly disagree about what "12-16 Oct" is worth.
 *
 * A day here is a `yyyy-MM-dd` string and never an instant. `lib/date.ts` is
 * about instants and the zone that bounds them; none of that applies to a
 * calendar date, and running one through `fmt` would only invite a timezone to
 * shift it. So the arithmetic below is done on the date parts directly.
 */

/** A `yyyy-MM-dd`, as a UTC instant at midnight — a cursor, never a timestamp. */
function cursor(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The `yyyy-MM-dd` a cursor is sitting on. */
function stamp(at: Date): string {
  return at.toISOString().slice(0, 10);
}

const DAY = 86_400_000;

/**
 * `yyyy-MM-dd` for a given instant, on the reader's own calendar.
 *
 * The zone falls back to the department's rather than to `undefined`, which
 * `Intl` would read as the *server's* zone — the one place in this file where
 * getting it wrong would be silent and would only show up on a deployment in
 * another country.
 */
export function dayKey(at: Date, zone: string = APP_TIMEZONE): string {
  // `en-CA` is the locale that prints ISO order, which is the whole reason it
  // is used here rather than a format string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Shift a calendar day by whole days. */
export function addDays(day: string, days: number): string {
  return stamp(new Date(cursor(day).getTime() + days * DAY));
}

/** Whether a calendar day is Monday to Friday. */
export function isWeekday(day: string): boolean {
  const weekday = cursor(day).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

/**
 * How much leave a range is worth, in days.
 *
 * Weekdays, not calendar days. A system that bills somebody for the Saturday
 * in the middle of their fortnight is wrong in a way people notice on the
 * first request they file. There is no working week in the data model — the
 * `department` row carries hours, not days — and this deliberately does not
 * add one: Monday to Friday is hard-coded here, in one place, and the day it
 * needs to be configurable is the day it moves into `department` beside the
 * hours.
 */
export function leaveDays(
  startDate: string,
  endDate: string,
  half: LeaveHalf | null,
): number {
  if (half) return isWeekday(startDate) ? 0.5 : 0;
  let count = 0;
  for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
    if (isWeekday(day)) count += 1;
  }
  return count;
}

/** How much of one day a request covers, or null if it does not reach it. */
export function coversDay(
  request: { startDate: string; endDate: string; half: LeaveHalf | null },
  day: string,
): "full" | "am" | "pm" | null {
  if (day < request.startDate || day > request.endDate) return null;
  return request.half ?? "full";
}

/** Whether two inclusive ranges share any day at all. */
export function rangesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function dayOf(day: string): number {
  return Number(day.slice(8, 10));
}

function monthOf(day: string): string {
  return MONTHS[Number(day.slice(5, 7)) - 1];
}

/**
 * "14 Oct" · "12-16 Oct" · "28 Dec - 3 Jan"
 *
 * The month is repeated only when it changes, because the common case is a few
 * days inside one month and saying it twice there is noise.
 */
export function rangeText(startDate: string, endDate: string): string {
  if (startDate === endDate) return `${dayOf(startDate)} ${monthOf(startDate)}`;
  if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
    return `${dayOf(startDate)}–${dayOf(endDate)} ${monthOf(endDate)}`;
  }
  return `${dayOf(startDate)} ${monthOf(startDate)} – ${dayOf(endDate)} ${monthOf(endDate)}`;
}

/** Calendar days in an inclusive range, weekends included. */
export function spanDays(startDate: string, endDate: string): number {
  return Math.round((cursor(endDate).getTime() - cursor(startDate).getTime()) / DAY) + 1;
}

/**
 * "Half day (PM)" · "1 day" · "5 days" · "1 working day"
 *
 * The word "working" appears only when the range is longer than the count, so
 * it earns its place by answering the question it raises: "18–20 Sep · 1 day"
 * reads as a bug, and "18–20 Sep · 1 working day" reads as a weekend. The
 * common case — a run that is all weekdays — says "5 days" and stays short.
 */
export function lengthText(
  days: number,
  half: LeaveHalf | null,
  span?: number,
): string {
  if (half) return `Half day (${half.toUpperCase()})`;
  const unit = span !== undefined && span > days ? "working day" : "day";
  return `${days} ${unit}${days === 1 ? "" : "s"}`;
}
