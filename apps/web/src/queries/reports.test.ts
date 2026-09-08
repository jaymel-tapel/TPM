import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getBoardView, type BoardView } from "./tasks";
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

  const column = (board: BoardView, name: string) =>
    board.columns.find((c) => c.name === name)!;

  it("shows today's work plus what carried over, and nothing older", async () => {
    const board = await getBoardView(IDS.boardA, NOW);
    // Four due today, one carried over. The task closed last week is excluded,
    // or the Done column would grow without bound and become a backlog.
    expect(board!.total).toBe(5);
  });

  it("uses the board's own columns, in the board's own order", async () => {
    const board = await getBoardView(IDS.boardA, NOW);
    expect(board!.columns.map((c) => c.name)).toEqual([
      "To Do",
      "In Progress",
      "Done",
      "Blocked",
    ]);
    expect(column(board!, "To Do").tasks).toHaveLength(2); // one due today, one carried over
    expect(column(board!, "In Progress").tasks).toHaveLength(1);
    expect(column(board!, "Blocked").tasks).toHaveLength(1);
    expect(column(board!, "Done").tasks).toHaveLength(1);
  });

  it("carries the kind, so reporting never reads a column's name", async () => {
    const board = await getBoardView(IDS.boardA, NOW);
    // A board owner may rename any of these; `kind` is the contract.
    expect(column(board!, "Done").kind).toBe("done");
    expect(column(board!, "Blocked").kind).toBe("blocked");
    expect(column(board!, "To Do").kind).toBe("open");
  });

  it("returns nothing for a board that does not exist", async () => {
    expect(await getBoardView(IDS.boardB.replace("2", "9"), NOW)).toBeNull();
  });
});

describe("narrowing a board to one person", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();

    await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, status: "todo" });
    await addTask({ team: IDS.teamA, assignees: [IDS.james], dueDay: 0, status: "todo" });
    // Shared work counts for both, which is what makes this a filter on
    // assignment rather than on ownership.
    await addTask({
      team: IDS.teamA,
      assignees: [IDS.anna, IDS.james],
      dueDay: 0,
      status: "in_progress",
    });
  });

  it("shows the whole board by default", async () => {
    const board = await getBoardView(IDS.boardA, NOW);
    expect(board!.total).toBe(3);
  });

  it("keeps only the work that person is on, shared work included", async () => {
    const anna = await getBoardView(IDS.boardA, NOW, IDS.anna);
    expect(anna!.total).toBe(2);

    const james = await getBoardView(IDS.boardA, NOW, IDS.james);
    expect(james!.total).toBe(2);
  });

  it("keeps the board's columns even when none of them hold your work", async () => {
    // The filter narrows the cards, not the board. A column that empties is
    // still a column — it is where the work would go.
    const mika = await getBoardView(IDS.boardA, NOW, IDS.mika);
    expect(mika!.total).toBe(0);
    expect(mika!.columns.map((c) => c.name)).toEqual([
      "To Do",
      "In Progress",
      "Done",
      "Blocked",
    ]);
  });
});
