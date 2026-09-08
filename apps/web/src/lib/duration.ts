/**
 * Durations, typed the way people say them: "1hr", "3d", "2d 4h", "90m".
 *
 * Pure and client-safe on purpose — the form parses as you type so it can show
 * what it understood, and the action parses again on submit. Both must agree,
 * so there is one implementation.
 *
 * ── The one decision worth arguing about ──
 * A day is eight hours and a week is five days, because an estimate is *effort*
 * and nobody typing "1d" means twenty-four hours of work. This is what ClickUp,
 * Jira and Linear all do.
 *
 * Elapsed time is a different quantity — the reports screen has its own local
 * formatter for "average completion time", where a day really is 24 hours.
 * Do not point that one at this module.
 */

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 8;
const DAYS_PER_WEEK = 5;

const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY; // 480
const MINUTES_PER_WEEK = MINUTES_PER_DAY * DAYS_PER_WEEK; // 2400

/**
 * A hundred working weeks. Past this it is a programme of work, not a task —
 * and the column is an `integer`, so an unbounded parse turns a fat-fingered
 * "99999999w" into a Postgres overflow thrown out of a server action.
 */
export const MAX_DURATION_MINUTES = 100 * MINUTES_PER_WEEK;

const UNIT_MINUTES: Record<string, number> = {
  m: 1,
  min: 1,
  mins: 1,
  minute: 1,
  minutes: 1,
  h: MINUTES_PER_HOUR,
  hr: MINUTES_PER_HOUR,
  hrs: MINUTES_PER_HOUR,
  hour: MINUTES_PER_HOUR,
  hours: MINUTES_PER_HOUR,
  d: MINUTES_PER_DAY,
  day: MINUTES_PER_DAY,
  days: MINUTES_PER_DAY,
  w: MINUTES_PER_WEEK,
  wk: MINUTES_PER_WEEK,
  week: MINUTES_PER_WEEK,
  weeks: MINUTES_PER_WEEK,
};

/** One `<number><unit>` pair. The unit is optional only for a bare number. */
const TERM = /(\d+(?:\.\d+)?)\s*([a-z]*)/gi;

/**
 * Minutes, or null when the input is not a duration at all.
 *
 * An empty string is null rather than 0: "not estimated" and "estimated at
 * nothing" are different answers, and the column is nullable so it can hold
 * both.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  // Reject anything that is not made only of number/unit pairs, so "soon" or
  // "3 apples" fail loudly instead of silently reading as 3 minutes.
  if (!/^(\d+(?:\.\d+)?\s*[a-z]*\s*)+$/.test(text)) return null;

  let total = 0;
  let matched = false;

  TERM.lastIndex = 0;
  for (const [, amount, unit] of text.matchAll(TERM)) {
    const per = unit ? UNIT_MINUTES[unit] : 1;
    if (per === undefined) return null; // a unit we do not know
    total += Number(amount) * per;
    matched = true;
  }

  if (!matched) return null;
  if (total > MAX_DURATION_MINUTES) return null;
  return Math.round(total);
}

/**
 * Minutes back into the shortest phrase that reads the same way it was typed.
 * `formatDuration(parseDuration(x))` is stable for anything this accepts.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "";
  if (minutes === 0) return "0m";

  const weeks = Math.floor(minutes / MINUTES_PER_WEEK);
  const days = Math.floor((minutes % MINUTES_PER_WEEK) / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const mins = minutes % MINUTES_PER_HOUR;

  const parts: string[] = [];
  if (weeks) parts.push(`${weeks}w`);
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);
  return parts.join(" ");
}
