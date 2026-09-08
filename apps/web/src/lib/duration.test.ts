import { describe, expect, it } from "vitest";
import { MAX_DURATION_MINUTES, formatDuration, parseDuration } from "./duration";

describe("parseDuration", () => {
  it("reads the units people actually type", () => {
    expect(parseDuration("30m")).toBe(30);
    expect(parseDuration("90m")).toBe(90);
    expect(parseDuration("1h")).toBe(60);
    expect(parseDuration("1hr")).toBe(60);
    expect(parseDuration("2 hours")).toBe(120);
  });

  it("counts a day as eight hours and a week as five days", () => {
    // The whole point of the module. An estimate is effort: "1d" is a day's
    // work, not a day on the calendar. If this ever reads 1440 or 10080, every
    // estimate in the system has silently changed meaning.
    expect(parseDuration("1d")).toBe(480);
    expect(parseDuration("3d")).toBe(1440);
    expect(parseDuration("1w")).toBe(2400);
    expect(parseDuration("1w")).not.toBe(7 * 24 * 60);
  });

  it("adds compound terms, with or without spaces", () => {
    expect(parseDuration("2d 4h")).toBe(1200);
    expect(parseDuration("2d4h")).toBe(1200);
    expect(parseDuration("1h30m")).toBe(90);
    expect(parseDuration("1w 1d 1h 1m")).toBe(2400 + 480 + 60 + 1);
  });

  it("treats a bare number as minutes", () => {
    expect(parseDuration("45")).toBe(45);
  });

  it("ignores case and surrounding space", () => {
    expect(parseDuration("  2D 4H  ")).toBe(1200);
  });

  it("rounds a fractional term to the minute", () => {
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("0.5d")).toBe(240);
  });

  it("refuses a duration too large for the column", () => {
    // `estimate_minutes` is an integer. Without a cap, a fat-fingered "9999w"
    // reaches Postgres as an out-of-range value and throws out of a server
    // action rather than coming back as a form error.
    expect(parseDuration("100w")).toBe(MAX_DURATION_MINUTES);
    expect(parseDuration("101w")).toBeNull();
    expect(parseDuration("99999999w")).toBeNull();
  });

  it("sums repeated units rather than taking the last", () => {
    expect(parseDuration("1h 30m 30m")).toBe(120);
  });

  it("keeps zero, which is not the same as unset", () => {
    expect(parseDuration("0h")).toBe(0);
    expect(parseDuration("0")).toBe(0);
  });

  it("refuses anything that is not a duration", () => {
    // Silently reading "3 apples" as three minutes would put a number in the
    // database that nobody typed.
    for (const bad of ["", "   ", "soon", "3 apples", "tomorrow", "1x", "-5m", "h"]) {
      expect(parseDuration(bad)).toBeNull();
    }
  });
});

describe("formatDuration", () => {
  it("says nothing when there is nothing to say", () => {
    // Null is "not estimated"; zero is "estimated at nothing". Different.
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(undefined)).toBe("");
    expect(formatDuration(0)).toBe("0m");
  });

  it("uses the largest units that fit", () => {
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(480)).toBe("1d");
    expect(formatDuration(1200)).toBe("2d 4h");
    expect(formatDuration(2400)).toBe("1w");
  });

  it("round-trips every boundary between units", () => {
    for (const minutes of [1, 59, 60, 61, 479, 480, 481, 2399, 2400, 2401, MAX_DURATION_MINUTES]) {
      expect(parseDuration(formatDuration(minutes))).toBe(minutes);
    }
  });

  it("round-trips anything the parser accepts", () => {
    for (const typed of ["30m", "1h", "1h 30m", "1d", "2d 4h", "1w", "1w 1d 1h 1m"]) {
      expect(formatDuration(parseDuration(typed))).toBe(typed);
    }
  });
});
