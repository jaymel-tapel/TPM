import { beforeEach, describe, expect, it } from "vitest";
import { IDS, NOW, addTask, resetDb, seedOrg } from "../../test/fixture";
import { getDayView } from "./tasks";
import { getReportMetrics } from "./reports";
import { userScope } from "./sql";

/**
 * A day boundary belongs to whoever is reckoning it.
 *
 * These are the tests for the cost of per-person timezones, written so the
 * cost is visible rather than discovered: the same rows, read by two people,
 * give two different — and both correct — answers. If someone later decides
 * that is unacceptable, this is the file that tells them what they are
 * changing.
 *
 * The fixture clock is 1pm on Monday 7 September 2026 in Manila, which is
 * 10pm on Sunday 6 September in Los Angeles.
 */
const MANILA = "Asia/Manila";
const LA = "America/Los_Angeles";

describe("what counts as due today", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("depends on the reader, not on the row", async () => {
    // 8pm Monday in Manila is 5am Monday in Los Angeles — but the reader in
    // Los Angeles is still on Sunday, so for them this is tomorrow's work.
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0, dueHour: 20 });

    const manila = await getDayView(IDS.anna, NOW, MANILA);
    const la = await getDayView(IDS.anna, NOW, LA);

    expect(manila.due).toBe(1);
    expect(la.due).toBe(0);
  });

  it("still adds up for each reader on their own terms", async () => {
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0, dueHour: 20 });
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0, dueHour: 9 });

    for (const zone of [MANILA, LA]) {
      const view = await getDayView(IDS.anna, NOW, zone);
      // Whatever the boundary, the parts still account for the whole.
      expect(view.today.length + view.completed.length).toBe(view.due);
    }
  });

  it("agrees when nothing sits near a boundary", async () => {
    // Mid-afternoon Manila is mid-morning the same day in neither reader's
    // edge case; both should see it. A test that only ever disagrees would not
    // catch a helper that had started ignoring its zone argument.
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0, dueHour: 12 });
    expect((await getDayView(IDS.anna, NOW, MANILA)).due).toBe(1);
    expect((await getDayView(IDS.anna, NOW, LA)).due).toBe(1);
  });
});

describe("what counts as finished on time", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("is measured against the reader's end of day", async () => {
    /*
     * Due 8pm Monday Manila, finished 10pm Monday Manila.
     *
     * Manila: the due day ends at midnight Manila, so this is on time.
     * Los Angeles: the same deadline falls on their Monday, which ends at
     * midnight Pacific — long after — so it is on time there too.
     * The rate is the same here; what the test pins is that both readers get a
     * coherent answer computed in their own zone rather than a crash or a
     * silent fallback.
     */
    await addTask({
      account: IDS.nike,
      assignees: [IDS.anna],
      dueDay: 0,
      dueHour: 20,
      completedDay: 0,
      completedHour: 22,
    });

    const manila = await getReportMetrics(userScope(IDS.anna), 7, NOW, MANILA);
    const la = await getReportMetrics(userScope(IDS.anna), 7, NOW, LA);

    expect(manila.onTimeRate).toBe(100);
    expect(la.onTimeRate).toBe(100);
  });

  it("counts late work late in both readings", async () => {
    // Finished two days after it was due: no day boundary anywhere makes that
    // punctual.
    await addTask({
      account: IDS.nike,
      assignees: [IDS.anna],
      dueDay: -3,
      dueHour: 10,
      completedDay: -1,
      completedHour: 10,
    });

    for (const zone of [MANILA, LA]) {
      const m = await getReportMetrics(userScope(IDS.anna), 7, NOW, zone);
      expect(m.onTimeRate).toBe(0);
    }
  });
});

describe("what is still coming", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("reaches as far ahead as the plan does, and no further", async () => {
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 2 });
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 6 });
    // Beyond the horizon: real work, but nothing you could put in a day yet.
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 30 });

    const view = await getDayView(IDS.anna, NOW, MANILA);
    expect(view.upcoming).toHaveLength(2);
  });

  it("leaves today's own arithmetic alone", async () => {
    /*
     * The completion percentage is about today. If tomorrow's work counted
     * towards it, the number would fall every time somebody planned ahead —
     * which is exactly the behaviour the brief warns against.
     */
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0, completedDay: 0 });
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 3 });

    const view = await getDayView(IDS.anna, NOW, MANILA);
    expect(view.due).toBe(1);
    expect(view.done).toBe(1);
    expect(view.percent).toBe(100);
    expect(view.upcoming).toHaveLength(1);
  });

  it("reads in the order the work arrives", async () => {
    // Chronological, not by priority: "what is coming" is a question about
    // time, and the day's own lists are the ones that put urgent work first.
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 5 });
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 1 });
    await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 3 });

    const due = (await getDayView(IDS.anna, NOW, MANILA)).upcoming.map((t) =>
      t.dueDate.getTime(),
    );
    expect(due).toEqual([...due].sort((a, b) => a - b));
  });

  it("says nothing about work already finished", async () => {
    await addTask({
      account: IDS.nike,
      assignees: [IDS.anna],
      dueDay: 2,
      completedDay: 0,
    });
    expect((await getDayView(IDS.anna, NOW, MANILA)).upcoming).toEqual([]);
  });
});
