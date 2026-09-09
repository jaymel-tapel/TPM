/**
 * How much of the recent past an account screen is reporting.
 *
 * Two windows, not a date picker. "How did today go" and "how is the week
 * going" are the two questions a roster actually answers; anything finer is
 * the report's job, and anything coarser stops being about the people in front
 * of you.
 */
export type RangeKind = "day" | "week";

/** Whole days ending today, today included. */
export const RANGE_DAYS: Record<RangeKind, number> = { day: 1, week: 7 };

/** What the section is called. Precise rather than friendly: "this week" would
 *  claim a Monday boundary the window does not have. */
export const RANGE_LABEL: Record<RangeKind, string> = {
  day: "Today",
  week: "Last 7 days",
};

/** The headline the completion figure carries. */
export const RANGE_METRIC_LABEL: Record<RangeKind, string> = {
  day: "Completion today",
  week: "Completion, last 7 days",
};

/**
 * A range out of a query string, which is user input and may be anything.
 * Anything that is not "week" is today — the screen's default is the day.
 */
export function parseRange(value: unknown): RangeKind {
  return value === "week" ? "week" : "day";
}
