import { describe, expect, it } from "vitest";
import { dayRange, dueLabel, lastNDays, pct, startOfAppDay } from "./date";

/**
 * Every "due today" and "completed that day" comparison in the product goes
 * through these. The seed, the queries and the UI agree about where a day
 * begins only because they all call the same helper — so if this drifts, every
 * number on every screen drifts with it, silently.
 *
 * APP_TIMEZONE is Asia/Manila (UTC+8, no DST) in tests.
 */
/** These are TZDate instances, so compare instants rather than strings —
 *  `toISOString()` renders them with a +08:00 offset, not as Z. */
const at = (iso: string) => new Date(iso).getTime();

describe("day boundaries", () => {
  it("starts the day at local midnight, not UTC midnight", () => {
    // 2026-09-07T02:00Z is already 10am on the 7th in Manila, so the day
    // began at 2026-09-07T00:00+08:00 — which is 16:00Z the day before.
    expect(startOfAppDay(new Date("2026-09-07T02:00:00Z")).getTime()).toBe(
      at("2026-09-06T16:00:00Z"),
    );
  });

  it("puts late-evening UTC into the next Manila day", () => {
    // 2026-09-06T17:00Z is 1am on the 7th in Manila — a different calendar day
    // from 2026-09-06T15:00Z, which is still the 6th there.
    expect(startOfAppDay(new Date("2026-09-06T17:00:00Z")).getTime()).toBe(
      at("2026-09-06T16:00:00Z"),
    );
    expect(startOfAppDay(new Date("2026-09-06T15:00:00Z")).getTime()).toBe(
      at("2026-09-05T16:00:00Z"),
    );
  });

  it("returns a half-open range exactly 24 hours wide", () => {
    const { start, end } = dayRange(new Date("2026-09-07T05:00:00Z"));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("treats the final millisecond of a day as that day", () => {
    const { start, end } = dayRange(new Date("2026-09-07T05:00:00Z"));
    const lastMoment = new Date(end.getTime() - 1);
    expect(startOfAppDay(lastMoment).getTime()).toBe(start.getTime());
  });

  it("rolls to the next day one millisecond later", () => {
    const { start, end } = dayRange(new Date("2026-09-07T05:00:00Z"));
    expect(startOfAppDay(end).getTime()).toBe(start.getTime() + 24 * 60 * 60 * 1000);
  });

  it("returns N consecutive days, oldest first, ending today", () => {
    const days = lastNDays(7, new Date("2026-09-07T05:00:00Z"));
    expect(days).toHaveLength(7);
    expect(days.at(-1)!.getTime()).toBe(startOfAppDay(new Date("2026-09-07T05:00:00Z")).getTime());
    for (let i = 1; i < days.length; i++) {
      expect(days[i].getTime() - days[i - 1].getTime()).toBe(24 * 60 * 60 * 1000);
    }
  });
});

describe("dueLabel", () => {
  const reference = new Date("2026-09-07T05:00:00Z"); // 1pm Manila

  it("says Today for anything inside today", () => {
    expect(dueLabel(new Date("2026-09-07T06:00:00Z"), reference)).toMatch(/^Today, /);
  });

  it("says Yesterday for the day before, even hours apart", () => {
    expect(dueLabel(new Date("2026-09-06T06:00:00Z"), reference)).toMatch(/^Yesterday, /);
  });

  it("names the date once it is further out", () => {
    expect(dueLabel(new Date("2026-09-04T06:00:00Z"), reference)).toMatch(/^Sep 4, /);
  });
});

describe("pct", () => {
  it("rounds to whole numbers", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
  });

  it("reads an empty day as 100%, not NaN", () => {
    // Nothing due and nothing done is a finished day, not a failed one.
    expect(pct(0, 0)).toBe(100);
  });
});
