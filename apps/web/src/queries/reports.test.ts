import { beforeAll, describe, expect, it } from "vitest";
import { getBoardView } from "./tasks";
import { getCompletionTrend, getReportMetrics } from "./reports";
import { departmentScope, teamScope, userScope } from "./sql";
import { IDS, NOW, addTask, resetDb, seedOrg } from "../../test/fixture";

/**
 * The completion rate the brief specifies:
 *
 *     tasks due that day that were completed by end of that day
 *     ─────────────────────────────────────────────────────────
 *                  total tasks due that day
 *
 * Every screen in the product reads this one definition. The failure it is
 * built to prevent is a task finished three days late still counting toward
 * the day it was due — which would make a struggling team look fine.
 */
describe("completion rate", () => {
  beforeAll(async () => {
    await resetDb();
    await seedOrg();

    // Team A, all due today.
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, completedDay: 0 });
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, completedDay: 0 });
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, completedDay: null });
    // Finished, but a day late — must NOT count toward today.
    await addTask({ team: IDS.teamA, assignees: [IDS.james], dueDay: 0, completedDay: 1 });

    // Team B, all due today: one on time, one still open.
    await addTask({ team: IDS.teamB, assignees: [IDS.mika], dueDay: 0, completedDay: 0 });
    await addTask({ team: IDS.teamB, assignees: [IDS.mika], dueDay: 0, completedDay: null });
  });

  it("counts only work finished by the end of the day it was due", async () => {
    // Team A: 4 due today, 2 finished today, 1 open, 1 finished tomorrow.
    const a = await getReportMetrics(teamScope(IDS.teamA), 1, NOW);
    expect(a.due).toBe(4);
    expect(a.completionRate).toBe(50);
  });

  it("still counts the late one as completed, just not on time", async () => {
    const a = await getReportMetrics(teamScope(IDS.teamA), 1, NOW);
    // 3 of the 4 have a completed_at; only 2 landed before end of due day.
    expect(a.completed).toBe(3);
    expect(a.onTimeRate).toBe(67);
  });

  it("computes the department from raw counts, not an average of teams", async () => {
    // Team A is 2/4 (50%), Team B is 1/2 (50%). Six tasks, three on time.
    const dept = await getReportMetrics(departmentScope, 1, NOW);
    expect(dept.due).toBe(6);
    expect(dept.completionRate).toBe(50);
  });

  it("scopes to a person through task_assignees", async () => {
    const anna = await getReportMetrics(userScope(IDS.anna), 1, NOW);
    expect(anna.due).toBe(3);
    expect(anna.completionRate).toBe(67);
  });
});

describe("overdue", () => {
  beforeAll(async () => {
    await resetDb();
    await seedOrg();

    // Due earlier today, unfinished — remaining, not overdue.
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, dueHour: 9, completedDay: null });
    // Due yesterday, unfinished — genuinely carried over.
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: -1, completedDay: null });
    await addTask({ team: IDS.teamA, assignees: [IDS.james], dueDay: -2, completedDay: null });
    // Due yesterday but finished late — closed, so not overdue.
    await addTask({ team: IDS.teamA, assignees: [IDS.james], dueDay: -1, completedDay: 0 });
  });

  it("does not count today's unfinished work as overdue", async () => {
    // If this counted clock time rather than calendar day, it would be 3.
    const a = await getReportMetrics(teamScope(IDS.teamA), 7, NOW);
    expect(a.overdue).toBe(2);
  });
});

describe("completion trend", () => {
  beforeAll(async () => {
    await resetDb();
    await seedOrg();

    // Yesterday: 2 due, 1 on time  → 50%
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: -1, completedDay: -1 });
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: -1, completedDay: null });
    // Today: 1 due, 1 on time      → 100%
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, completedDay: 0 });
    // Two days ago: nothing due    → 0%, not a misleading 100%
  });

  it("returns one point per day, oldest first", async () => {
    const trend = await getCompletionTrend(teamScope(IDS.teamA), 3, NOW);
    expect(trend).toHaveLength(3);
    expect(trend.map((p) => p.due)).toEqual([0, 2, 1]);
  });

  it("scores each day against what was due that day", async () => {
    const trend = await getCompletionTrend(teamScope(IDS.teamA), 3, NOW);
    expect(trend.map((p) => p.percent)).toEqual([0, 50, 100]);
  });

  it("reads a day with nothing due as 0%, not 100%", async () => {
    // pct() treats 0/0 as 100 for a person's day, but a trend line must not
    // spike to full on an empty day — that would invent a good day.
    const trend = await getCompletionTrend(teamScope(IDS.teamA), 3, NOW);
    expect(trend[0]).toMatchObject({ due: 0, done: 0, percent: 0 });
  });
});

describe("board grouping", () => {
  beforeAll(async () => {
    await resetDb();
    await seedOrg();

    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, status: "todo", completedDay: null });
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, status: "in_progress", completedDay: null });
    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, status: "blocked", completedDay: null });
    await addTask({ team: IDS.teamA, assignees: [IDS.james], dueDay: 0, completedDay: 0 });
    // Carried over from an earlier day — belongs on today's board.
    await addTask({ team: IDS.teamA, assignees: [IDS.james], dueDay: -2, status: "todo", completedDay: null });
    // Finished last week: closed and long gone, must not appear.
    await addTask({ team: IDS.teamA, assignees: [IDS.james], dueDay: -6, completedDay: -6 });
  });

  it("shows today's work plus what carried over, and nothing older", async () => {
    const board = await getBoardView(teamScope(IDS.teamA), NOW);
    // Four due today, one carried over. The task closed last week is excluded,
    // or the Done column would grow without bound and become a backlog.
    expect(board.total).toBe(5);
  });

  it("groups by status", async () => {
    const board = await getBoardView(teamScope(IDS.teamA), NOW);
    expect(board.todo).toHaveLength(2); // one due today, one carried over
    expect(board.in_progress).toHaveLength(1);
    expect(board.blocked).toHaveLength(1);
    expect(board.done).toHaveLength(1);
  });

  it("puts a completed task in Done whatever status column it was left in", async () => {
    // completed_at is the source of truth everywhere else, so it is here too.
    await addTask({
      team: IDS.teamA,
      assignees: [IDS.anna],
      dueDay: 0,
      status: "in_progress",
      completedDay: 0,
    });
    const board = await getBoardView(teamScope(IDS.teamA), NOW);
    expect(board.done).toHaveLength(2);
    expect(board.in_progress).toHaveLength(1);
  });
});
