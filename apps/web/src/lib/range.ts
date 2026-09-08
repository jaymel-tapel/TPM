/**
 * How much of the recent past a team screen is reporting.
 *
 * Two windows, not a date picker. "How did today go" and "how is the week
 * going" are the two questions a roster actually answers; anything finer is
 * the report's job, and anything coarser stops being about the people in front
 * of you.
 */
export type TeamRange = "day" | "week";

/** Whole days ending today, today included. */
export const RANGE_DAYS: Record<TeamRange, number> = { day: 1, week: 7 };

/** What the section is called. Precise rather than friendly: "this week" would
 *  claim a Monday boundary the window does not have. */
export const RANGE_LABEL: Record<TeamRange, string> = {
  day: "Today",
  week: "Last 7 days",
};

/** The headline the completion figure carries. */
export const RANGE_METRIC_LABEL: Record<TeamRange, string> = {
  day: "Completion today",
  week: "Completion, last 7 days",
};

/**
 * A range out of a query string, which is user input and may be anything.
 * Anything that is not "week" is today — the screen's default is the day.
 */
export function parseRange(value: unknown): TeamRange {
  return value === "week" ? "week" : "day";
}
