import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import { APP_TIMEZONE, fmt } from "./date";
import { layoutBlocks } from "@tpm/ui";
import {
  PLAN_DAYS,
  planDays,
  withinPlanHorizon,
  DEFAULT_BLOCK,
  MAX_BLOCK,
  MIN_BLOCK,
  atMinutes,
  clampBlock,
  gridRange,
  minutesFromMidnight,
  nextFreeSlot,
  snapToSlot,
} from "./plan";

/** A local instant on the app's day, the way a drop would produce one. */
const at = (h: number, m = 0) =>
  new TZDate(2026, 8, 8, h, m, 0, 0, APP_TIMEZONE) as unknown as Date;

describe("snapToSlot", () => {
  it("rounds down to the quarter hour", () => {
    expect(minutesFromMidnight(snapToSlot(at(10, 7)))).toBe(10 * 60);
    expect(minutesFromMidnight(snapToSlot(at(10, 14)))).toBe(10 * 60);
    expect(minutesFromMidnight(snapToSlot(at(10, 15)))).toBe(10 * 60 + 15);
    expect(minutesFromMidnight(snapToSlot(at(10, 59)))).toBe(10 * 60 + 45);
  });

  it("leaves a time already on a slot alone", () => {
    expect(minutesFromMidnight(snapToSlot(at(14, 30)))).toBe(14 * 60 + 30);
  });

  it("drops seconds, so two drops in the same minute agree", () => {
    const a = new Date(at(9, 5).getTime() + 42_000);
    expect(snapToSlot(a).getSeconds()).toBe(0);
    expect(snapToSlot(a).getMilliseconds()).toBe(0);
  });
});

describe("minutesFromMidnight / atMinutes", () => {
  it("measures against the app's day, not the machine's", () => {
    // The whole reason this helper exists. If it ever reads the server's local
    // midnight, every block shifts by the timezone offset.
    expect(minutesFromMidnight(at(0, 0))).toBe(0);
    expect(minutesFromMidnight(at(10, 30))).toBe(630);
    expect(minutesFromMidnight(at(23, 45))).toBe(1425);
  });

  it("round-trips", () => {
    for (const m of [0, 15, 630, 1425]) {
      expect(minutesFromMidnight(atMinutes(at(12), m))).toBe(m);
    }
  });
});

describe("clampBlock", () => {
  it("keeps a length on the grid and inside the bounds", () => {
    expect(clampBlock(DEFAULT_BLOCK)).toBe(30);
    expect(clampBlock(37)).toBe(30);
    expect(clampBlock(38)).toBe(45);
    expect(clampBlock(0)).toBe(MIN_BLOCK);
    expect(clampBlock(-90)).toBe(MIN_BLOCK);
    expect(clampBlock(99_999)).toBe(MAX_BLOCK);
  });
});

describe("gridRange", () => {
  it("is a working day when nothing sits outside one", () => {
    expect(gridRange([{ startMinutes: 9 * 60, minutes: 60 }])).toEqual({
      startHour: 7,
      endHour: 21,
    });
  });

  it("widens rather than hiding a block you planned", () => {
    expect(gridRange([{ startMinutes: 6 * 60 + 30, minutes: 30 }]).startHour).toBe(6);
    expect(gridRange([{ startMinutes: 22 * 60, minutes: 90 }]).endHour).toBe(24);
  });

  it("never runs past the ends of the day", () => {
    const r = gridRange([{ startMinutes: 0, minutes: 24 * 60 }]);
    expect(r).toEqual({ startHour: 0, endHour: 24 });
  });
});

describe("layoutBlocks", () => {
  it("gives a lone block the whole width", () => {
    const [b] = layoutBlocks([{ startMinutes: 600, minutes: 60 }]);
    expect(b).toMatchObject({ left: 0, width: 1 });
  });

  it("does not treat back-to-back blocks as overlapping", () => {
    /*
     * The case that always gets written wrong. Ten-to-half-ten and
     * half-ten-to-eleven do not collide, and a tidy day should not render as
     * two narrow columns because someone reached for `<=`.
     */
    const out = layoutBlocks([
      { startMinutes: 600, minutes: 30 },
      { startMinutes: 630, minutes: 30 },
    ]);
    expect(out.map((b) => b.width)).toEqual([1, 1]);
  });

  it("splits the width between blocks that genuinely collide", () => {
    const out = layoutBlocks([
      { startMinutes: 600, minutes: 60 },
      { startMinutes: 630, minutes: 60 },
    ]);
    expect(out.map((b) => b.width)).toEqual([0.5, 0.5]);
    expect(out.map((b) => b.left)).toEqual([0, 0.5]);
  });

  it("keeps a chain together — A meets B, B meets C, so all three share", () => {
    const out = layoutBlocks([
      { startMinutes: 600, minutes: 60 },
      { startMinutes: 630, minutes: 60 },
      { startMinutes: 660, minutes: 60 },
    ]);
    expect(out.every((b) => b.width === 1 / 3)).toBe(true);
  });

  it("starts a fresh group after a gap", () => {
    const out = layoutBlocks([
      { startMinutes: 600, minutes: 60 },
      { startMinutes: 630, minutes: 60 },
      { startMinutes: 900, minutes: 30 },
    ]);
    expect(out.map((b) => b.width)).toEqual([0.5, 0.5, 1]);
  });

  it("does not mutate what it was given", () => {
    const input = [
      { startMinutes: 900, minutes: 30 },
      { startMinutes: 600, minutes: 60 },
    ];
    layoutBlocks(input);
    expect(input[0]!.startMinutes).toBe(900);
  });
});

describe("nextFreeSlot", () => {
  it("takes the time asked for when the day is empty", () => {
    expect(nextFreeSlot([], 10 * 60, 30)).toBe(600);
  });

  it("never starts before the working day", () => {
    // "Next free slot from now" at six in the morning still means the day's
    // start, not six.
    expect(nextFreeSlot([], 3 * 60, 30)).toBe(7 * 60);
  });

  it("steps past what is already booked", () => {
    const taken = [{ startMinutes: 600, minutes: 60 }];
    expect(nextFreeSlot(taken, 600, 30)).toBe(660);
  });

  it("finds a gap big enough rather than the first gap", () => {
    const taken = [
      { startMinutes: 600, minutes: 60 },
      { startMinutes: 675, minutes: 60 },
    ];
    // The 15-minute hole at 11:00 will not hold half an hour.
    expect(nextFreeSlot(taken, 600, 30)).toBe(735);
  });

  it("uses a gap that does fit", () => {
    const taken = [
      { startMinutes: 600, minutes: 60 },
      { startMinutes: 720, minutes: 60 },
    ];
    expect(nextFreeSlot(taken, 600, 30)).toBe(660);
  });

  it("snaps a ragged start up to a slot", () => {
    expect(nextFreeSlot([], 10 * 60 + 1, 30)).toBe(10 * 60 + 15);
  });

  it("wraps to the working day rather than stacking when the evening is full", () => {
    /*
     * The bug this replaced: with no room left before midnight, clamping to
     * "the latest start that still fits" lands exactly on the block already
     * there. Pressing Plan twice late at night stacked both on one slot.
     */
    const taken = [{ startMinutes: 1400, minutes: 40 }];
    expect(nextFreeSlot(taken, 1400, 60)).toBe(7 * 60);
  });

  it("takes the last slot that fits only when the whole day is full", () => {
    const wall = [{ startMinutes: 0, minutes: 24 * 60 }];
    expect(nextFreeSlot(wall, 600, 30)).toBe(24 * 60 - 30);
  });

  it("skips a block that has already finished", () => {
    const taken = [{ startMinutes: 8 * 60, minutes: 60 }];
    expect(nextFreeSlot(taken, 14 * 60, 30)).toBe(14 * 60);
  });
});

describe("the planning horizon", () => {
  const today = at(12);

  it("offers a week, today first", () => {
    const days = planDays(today);
    expect(days).toHaveLength(PLAN_DAYS);
    expect(minutesFromMidnight(days[0]!)).toBe(0);
    // Consecutive calendar days. Deliberately not asserted as multiples of 24
    // hours: see the clocks-change test below.
    for (let i = 1; i < days.length; i += 1) {
      expect(days[i]!.getTime()).toBeGreaterThan(days[i - 1]!.getTime());
      expect(fmt(days[i]!, "yyyy-MM-dd")).not.toBe(fmt(days[i - 1]!, "yyyy-MM-dd"));
    }
  });

  it("accepts every day the strip offers, and nothing else", () => {
    /*
     * The rule the strip and the action share. The first version of the guard
     * compared a time against the day derived from that same time, so it could
     * never fail and a payload could file a block in any year it liked.
     */
    for (const day of planDays(today)) {
      expect(withinPlanHorizon(day, today)).toBe(true);
    }

    const yesterday = new Date(today.getTime() - 86_400_000);
    const tooFar = new Date(today.getTime() + PLAN_DAYS * 86_400_000);
    expect(withinPlanHorizon(yesterday, today)).toBe(false);
    expect(withinPlanHorizon(tooFar, today)).toBe(false);
    expect(withinPlanHorizon(new Date("2031-01-01T00:00:00Z"), today)).toBe(false);
  });

  it("counts earlier today as inside the window", () => {
    // It is noon; nine o'clock this morning is still a slot on this day, and
    // moving a block back to it must not be refused.
    expect(withinPlanHorizon(at(9), today)).toBe(true);
  });
});

describe("when the clocks change", () => {
  /*
   * The default timezone is Europe/London, which observes daylight saving —
   * unlike the zone the rest of the suite is pinned to. On the last Sunday in
   * October the clocks go back and the day is 25 hours long, so a planner that
   * assumed "a day is 86,400,000 milliseconds" would put every block an hour
   * out for anyone in the UK.
   */
  const LONDON = "Europe/London";
  // Saturday 24 October 2026; the clocks go back at 2am on Sunday the 25th.
  const before = new Date("2026-10-24T12:00:00Z");

  it("still offers seven distinct days across the change", () => {
    const days = planDays(before, LONDON);
    const labels = days.map((d) => fmt(d, "yyyy-MM-dd", LONDON));
    expect(new Set(labels).size).toBe(PLAN_DAYS);
    expect(labels[0]).toBe("2026-10-24");
    expect(labels[1]).toBe("2026-10-25");
    expect(labels[2]).toBe("2026-10-26");
  });

  it("makes the long day actually longer, rather than pretending", () => {
    const days = planDays(before, LONDON);
    // The clocks go back at 2am on Sunday, so Sunday itself is the 25-hour
    // day: Saturday to Sunday is still a normal 24.
    expect(days[1]!.getTime() - days[0]!.getTime()).toBe(24 * 3_600_000);
    expect(days[2]!.getTime() - days[1]!.getTime()).toBe(25 * 3_600_000);
  });

  it("keeps nine in the morning at nine in the morning either side of it", () => {
    // The thing a person would notice. If `atMinutes` worked in fixed
    // milliseconds, Sunday's blocks would all render an hour off.
    for (const day of planDays(before, LONDON)) {
      const nine = atMinutes(day, 9 * 60, LONDON);
      expect(fmt(nine, "H:mm", LONDON)).toBe("9:00");
      expect(minutesFromMidnight(nine, LONDON)).toBe(540);
    }
  });

  it("keeps the horizon honest across the change", () => {
    const days = planDays(before, LONDON);
    for (const day of days) {
      expect(withinPlanHorizon(day, before, LONDON)).toBe(true);
    }
  });
});
