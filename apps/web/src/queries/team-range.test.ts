import { beforeEach, describe, expect, it } from "vitest";
import { IDS, NOW, addTask, resetDb, seedOrg } from "../../test/fixture";
import { getTeamToday } from "./team";

/**
 * The team screen reports either today or the seven days behind it.
 *
 * The rule worth pinning is not the window — it is what the window is *not*
 * allowed to move. Overdue means carried over from an earlier day, and if it
 * followed the window then switching to the week would quietly forgive
 * everything inside it.
 */
describe("the team window", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  const anna = async (days?: number) => {
    const team = await getTeamToday(IDS.teamA, NOW, undefined, days);
    return team!.members.find((m) => m.id === IDS.anna)!;
  };

  it("counts only today by default", async () => {
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, completedDay: 0 });
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: -3, completedDay: -3 });

    const day = await anna();
    expect([day.due, day.done]).toEqual([1, 1]);
  });

  it("reaches back seven whole days on the week", async () => {
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, completedDay: 0 });
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: -3, completedDay: -3 });
    // The far edge: six days back is the oldest day the window includes.
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: -6, completedDay: -6 });
    // One day past it, and therefore out.
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: -7, completedDay: -7 });

    const week = await anna(7);
    expect([week.due, week.done]).toEqual([3, 3]);
  });

  it("keeps overdue anchored to today, whatever the window", async () => {
    // Due three days ago and never finished. It is overdue in both views —
    // widening the window must not absorb it into "remaining".
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: -3, completedDay: null });

    const day = await anna();
    const week = await anna(7);

    expect(day.overdue).toBe(1);
    expect(week.overdue).toBe(1);
    // It is still counted as due within the week, so the week's remaining
    // reflects it — but it has not stopped being late.
    expect(week.due).toBe(1);
    expect(week.done).toBe(0);
  });

  it("moves the team's own totals with the window too", async () => {
    await addTask({ team: IDS.teamA, assignees: [IDS.james], dueDay: -2, completedDay: -2 });

    const day = await getTeamToday(IDS.teamA, NOW);
    const week = await getTeamToday(IDS.teamA, NOW, undefined, 7);

    expect(day!.due).toBe(0);
    expect(week!.due).toBe(1);
    expect(week!.percent).toBe(100);
  });
});
