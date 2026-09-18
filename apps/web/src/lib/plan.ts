import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import type { Span } from "@tpm/ui";
import { APP_TIMEZONE, startOfAppDay, type Zone } from "@/lib/date";

/**
 * The geometry of a planned day.
 *
 * Pure arithmetic, deliberately not `server-only`: the action snaps a dropped
 * time with it, the query reads a block back with it, and the browser lays the
 * grid out with it. One definition, or the block you drop is not the block you
 * see.
 */

/** What a drop snaps to. Fifteen minutes is fine enough to mean something and
 *  coarse enough that nobody has to aim. */
export const SLOT_MINUTES = 15;

/** Given to a task on its first drop, when nothing better is known. */
export const DEFAULT_BLOCK = 30;

export const MIN_BLOCK = SLOT_MINUTES;
/** Ten hours. A day plan, not a sentence. */
export const MAX_BLOCK = 600;

/**
 * How far ahead you can plan.
 *
 * The strip offers exactly these days and the action accepts exactly these
 * days — one number, so nothing is offered that would be refused and nothing
 * is refused that was offered.
 */
export const PLAN_DAYS = 7;

/** The department's working day, and the fallback when nobody has said. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 21;

/** One person's working day, falling back to the department's. */
export type WorkHours = { startHour: number; endHour: number };

export function workHoursOf(
  user: { workStartHour: number | null; workEndHour: number | null },
  fallback: WorkHours = { startHour: DAY_START_HOUR, endHour: DAY_END_HOUR },
): WorkHours {
  const startHour = user.workStartHour ?? fallback.startHour;
  const endHour = user.workEndHour ?? fallback.endHour;
  // A day that ends before it begins is not a day; fall back rather than
  // render a grid with negative height.
  return endHour > startHour ? { startHour, endHour } : { startHour: DAY_START_HOUR, endHour: DAY_END_HOUR };
}

export const MINUTES_PER_HOUR = 60;
/** Pixels per hour. On the 4pt grid, so a quarter hour is 16px — exactly one
 *  line of `text-caption`, which is what a block needs to show a title. */
export const HOUR_HEIGHT = 64;

/** Down to the quarter hour. Dropping at 10:07 means ten o'clock. */
export function snapToSlot(at: Date): Date {
  const snapped = new Date(at.getTime());
  snapped.setSeconds(0, 0);
  snapped.setMinutes(Math.floor(snapped.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES);
  return snapped;
}

/**
 * How far into its own day an instant falls, in minutes.
 *
 * Measured against the app's day boundary rather than the machine's, so a
 * server in another timezone still puts ten o'clock at ten o'clock.
 */
export function minutesFromMidnight(at: Date, zone: Zone = APP_TIMEZONE): number {
  /*
   * Read off the clock rather than measured from midnight. On the day the
   * clocks go back a London day is twenty-five hours long, so nine in the
   * morning is ten hours after midnight — and a grid that placed blocks by
   * elapsed time would draw every one of them an hour out.
   */
  const d = new TZDate(at, zone);
  return d.getHours() * 60 + d.getMinutes();
}

/** Minutes from midnight back to a real instant on the given day. */
export function atMinutes(day: Date, minutes: number, zone: Zone = APP_TIMEZONE): Date {
  // Built from calendar fields for the same reason: adding milliseconds to
  // midnight lands an hour wrong whenever a transition falls in between.
  const d = new TZDate(startOfAppDay(day, zone), zone);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return new Date(d.getTime());
}

/** The day-start instants the strip offers, today first. */
export function planDays(reference: Date, zone?: Zone): Date[] {
  const today = startOfAppDay(reference, zone);
  return Array.from({ length: PLAN_DAYS }, (_, i) => startOfAppDay(addDays(today, i), zone));
}

/** Whether an instant falls in a day somebody is allowed to plan. */
export function withinPlanHorizon(at: Date, reference: Date, zone?: Zone): boolean {
  const first = startOfAppDay(reference, zone);
  const last = startOfAppDay(addDays(first, PLAN_DAYS), zone);
  return at >= first && at < last;
}

export function clampBlock(minutes: number): number {
  const snapped = Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
  return Math.min(MAX_BLOCK, Math.max(MIN_BLOCK, snapped));
}

export type { Span } from "@tpm/ui";

/**
 * The hours the grid draws.
 *
 * Seven to nine covers a working day without making the column a scroll
 * marathon, but it widens rather than hiding anything: a block at six in the
 * morning is a block you planned, and a grid that silently omitted it would be
 * lying.
 */
export function gridRange(
  blocks: Span[],
  hours: WorkHours = { startHour: DAY_START_HOUR, endHour: DAY_END_HOUR },
): { startHour: number; endHour: number } {
  let startHour = hours.startHour;
  let endHour = hours.endHour;

  for (const b of blocks) {
    startHour = Math.min(startHour, Math.floor(b.startMinutes / MINUTES_PER_HOUR));
    endHour = Math.max(endHour, Math.ceil((b.startMinutes + b.minutes) / MINUTES_PER_HOUR));
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}

/**
 * The first slot from `after` with room for the whole block — where the
 * keyboard path puts a task, so planning never requires a mouse.
 *
 * Scans forward past what is already booked, then, if the rest of the day is
 * full, tries again from the start of the working day. Without that second
 * pass, pressing Plan twice at half past eleven at night puts both blocks on
 * the same slot: the first scan finds no room, and clamping to "the last time
 * that fits before midnight" lands on the one thing already there.
 */
export function nextFreeSlot(
  taken: Span[],
  after: number,
  minutes: number,
  startHour: number = DAY_START_HOUR,
): number {
  const dayStart = startHour * MINUTES_PER_HOUR;
  /** The latest a block of this length can begin and still end today. */
  const lastStart = 24 * MINUTES_PER_HOUR - minutes;
  const busy = [...taken].sort((a, b) => a.startMinutes - b.startMinutes);

  const scan = (from: number): number | null => {
    let at = Math.max(0, Math.ceil(from / SLOT_MINUTES) * SLOT_MINUTES);
    for (const b of busy) {
      // Already behind us.
      if (b.startMinutes + b.minutes <= at) continue;
      // Fits in the gap before this one.
      if (at + minutes <= b.startMinutes) return at;
      at = b.startMinutes + b.minutes;
    }
    return at <= lastStart ? at : null;
  };

  return scan(Math.max(dayStart, after)) ?? scan(dayStart) ?? lastStart;
}
