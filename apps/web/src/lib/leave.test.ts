import { describe, expect, it } from "vitest";
import {
  addDays,
  coversDay,
  dayKey,
  isWeekday,
  leaveDays,
  lengthText,
  rangeText,
  rangesOverlap,
  spanDays,
} from "./leave";

// 2026-10-12 is a Monday, so 17-18 October is that week's weekend.
describe("leaveDays", () => {
  it("counts weekdays, never the weekend", () => {
    // The whole point of the module. If this ever reads 7, somebody has been
    // charged two days of holiday for a Saturday and a Sunday.
    expect(leaveDays("2026-10-12", "2026-10-16", null)).toBe(5);
    expect(leaveDays("2026-10-12", "2026-10-18", null)).toBe(5);
    expect(leaveDays("2026-10-12", "2026-10-19", null)).toBe(6);
  });

  it("counts a single day as one", () => {
    expect(leaveDays("2026-10-14", "2026-10-14", null)).toBe(1);
  });

  it("counts a half day as a half", () => {
    expect(leaveDays("2026-10-14", "2026-10-14", "pm")).toBe(0.5);
  });

  it("counts a weekend-only range as nothing, which is what refuses it", () => {
    expect(leaveDays("2026-10-17", "2026-10-18", null)).toBe(0);
    expect(leaveDays("2026-10-17", "2026-10-17", "am")).toBe(0);
  });
});

describe("coversDay", () => {
  const week = { startDate: "2026-10-12", endDate: "2026-10-16", half: null };

  it("includes both ends of the range", () => {
    expect(coversDay(week, "2026-10-12")).toBe("full");
    expect(coversDay(week, "2026-10-16")).toBe("full");
    expect(coversDay(week, "2026-10-14")).toBe("full");
  });

  it("stops outside it", () => {
    expect(coversDay(week, "2026-10-11")).toBeNull();
    expect(coversDay(week, "2026-10-17")).toBeNull();
  });

  it("reports which half, when it is half a day", () => {
    const afternoon = { startDate: "2026-10-14", endDate: "2026-10-14", half: "pm" as const };
    expect(coversDay(afternoon, "2026-10-14")).toBe("pm");
  });
});

describe("rangesOverlap", () => {
  const week = { startDate: "2026-10-12", endDate: "2026-10-16" };

  it("catches a range that touches at one end", () => {
    expect(rangesOverlap(week, { startDate: "2026-10-16", endDate: "2026-10-20" })).toBe(true);
    expect(rangesOverlap(week, { startDate: "2026-10-08", endDate: "2026-10-12" })).toBe(true);
  });

  it("lets an adjacent range through", () => {
    expect(rangesOverlap(week, { startDate: "2026-10-17", endDate: "2026-10-20" })).toBe(false);
    expect(rangesOverlap(week, { startDate: "2026-10-08", endDate: "2026-10-11" })).toBe(false);
  });
});

describe("addDays and isWeekday", () => {
  it("crosses a month boundary", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("knows the weekend", () => {
    expect(isWeekday("2026-10-16")).toBe(true); // Friday
    expect(isWeekday("2026-10-17")).toBe(false); // Saturday
    expect(isWeekday("2026-10-18")).toBe(false); // Sunday
    expect(isWeekday("2026-10-19")).toBe(true); // Monday
  });
});

describe("dayKey", () => {
  it("gives the calendar day of the reader, not of the server", () => {
    // 22:00 UTC is already tomorrow in Manila and still today in London. A
    // leave day belongs to whoever is reckoning it, the same way a due date
    // does.
    const at = new Date("2026-10-14T22:00:00Z");
    expect(dayKey(at, "Asia/Manila")).toBe("2026-10-15");
    expect(dayKey(at, "Europe/London")).toBe("2026-10-14");
  });
});

describe("rangeText and lengthText", () => {
  it("says the month once when it does not change", () => {
    expect(rangeText("2026-10-12", "2026-10-16")).toBe("12–16 Oct");
    expect(rangeText("2026-10-14", "2026-10-14")).toBe("14 Oct");
    expect(rangeText("2026-12-28", "2027-01-03")).toBe("28 Dec – 3 Jan");
  });

  it("writes a length a person would say out loud", () => {
    expect(lengthText(5, null)).toBe("5 days");
    expect(lengthText(1, null)).toBe("1 day");
    expect(lengthText(0.5, "pm")).toBe("Half day (PM)");
  });

  it("says \"working\" only when the range is longer than the count", () => {
    // 18-20 September 2026 is Friday to Sunday. "1 day" over a three-day range
    // reads as a bug; naming the unit is what turns it back into a weekend.
    expect(lengthText(1, null, spanDays("2026-09-18", "2026-09-20"))).toBe("1 working day");
    // A run that is all weekdays raises no question, so it stays short.
    expect(lengthText(5, null, spanDays("2026-10-12", "2026-10-16"))).toBe("5 days");
  });

  it("counts a span in calendar days", () => {
    expect(spanDays("2026-09-18", "2026-09-20")).toBe(3);
    expect(spanDays("2026-09-18", "2026-09-18")).toBe(1);
    expect(spanDays("2026-10-31", "2026-11-02")).toBe(3);
  });
});
