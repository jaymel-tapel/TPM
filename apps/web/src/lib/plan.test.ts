import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import { APP_TIMEZONE } from "./date";
import { layoutBlocks } from "@meridian/ui";
import {
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
