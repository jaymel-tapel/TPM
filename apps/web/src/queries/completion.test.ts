import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardStatuses, tasks } from "@/db/schema";
import { IDS, NOW, addTask, boardFor, resetDb, seedOrg, statusId } from "../../test/fixture";
import { getDayView } from "./tasks";
import { getReportMetrics } from "./reports";
import { getAccountToday } from "./accounts";
import { userScope } from "./sql";

/**
 * Completion belongs to the task, not to the column it happens to be in.
 *
 * These pin the consequence rather than the rule — `lib/completion.test.ts`
 * covers the rule itself. What matters here is that every number in the
 * product reads `completed_at` and nothing else, so a board can have as many
 * stages as the work needs without any of them changing what "done" means.
 */
describe("what the numbers read", () => {
  let taskId: string;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    taskId = await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0 });
  });

  const complete = (at: Date) =>
    db.update(tasks).set({ completedAt: at }).where(eq(tasks.id, taskId));

  const moveTo = (column: "todo" | "in_progress" | "done" | "blocked") =>
    db
      .update(tasks)
      .set({ statusId: statusId(boardFor(IDS.nike), column) })
      .where(eq(tasks.id, taskId));

  it("counts finished work wherever the card is sitting", async () => {
    /*
     * The whole point. A task can be complete and parked in "Client review"
     * because the client still has to see it; the day's number is about
     * whether the work is done, not about which column it is in.
     */
    await complete(NOW);
    for (const column of ["todo", "in_progress", "done", "blocked"] as const) {
      await moveTo(column);
      const day = await getDayView(IDS.anna, NOW);
      expect([column, day.done]).toEqual([column, 1]);
      expect([column, day.percent]).toEqual([column, 100]);
    }
  });

  it("does not count work that only reached the done column", async () => {
    // Sitting in Done with no completion date is not finished. That state is
    // reachable: mark something complete, move it to Done, then reopen it.
    await moveTo("done");
    await db.update(tasks).set({ completedAt: null }).where(eq(tasks.id, taskId));

    const day = await getDayView(IDS.anna, NOW);
    expect(day.done).toBe(0);
    expect(day.percent).toBe(0);
  });

  it("agrees between the person, the account and the report", async () => {
    await complete(NOW);
    await moveTo("in_progress");

    const day = await getDayView(IDS.anna, NOW);
    const account = await getAccountToday(IDS.nike, NOW);
    const report = await getReportMetrics(userScope(IDS.anna), 7, NOW);

    expect(day.done).toBe(1);
    expect(account!.done).toBe(1);
    expect(report.completed).toBe(1);
  });
});

describe("a board with more stages than three", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  /** Two extra stages after the finish line, the way a real board runs on. */
  const addStages = async () => {
    const board = boardFor(IDS.nike);
    await db.insert(boardStatuses).values([
      {
        id: "ffffffff-4000-4000-a000-" + board.slice(-12),
        boardId: board,
        name: "Client review",
        kind: "open",
        position: 4,
      },
      {
        id: "ffffffff-5000-4000-a000-" + board.slice(-12),
        boardId: board,
        name: "Delivered",
        kind: "open",
        position: 5,
      },
    ]);
    return {
      clientReview: "ffffffff-4000-4000-a000-" + board.slice(-12),
      delivered: "ffffffff-5000-4000-a000-" + board.slice(-12),
    };
  };

  it("reports exactly what a three-column board reports", async () => {
    const a = await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0 });
    const b = await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0 });
    await db.update(tasks).set({ completedAt: NOW }).where(eq(tasks.id, a));

    const before = await getDayView(IDS.anna, NOW);

    // Add the extra stages and park both tasks in them. Nothing was finished
    // or unfinished by doing that, so nothing may move.
    const { clientReview, delivered } = await addStages();
    await db.update(tasks).set({ statusId: delivered }).where(eq(tasks.id, a));
    await db.update(tasks).set({ statusId: clientReview }).where(eq(tasks.id, b));

    const after = await getDayView(IDS.anna, NOW);
    expect(after.due).toBe(before.due);
    expect(after.done).toBe(before.done);
    expect(after.percent).toBe(before.percent);
  });

  it("still finds what has not been started on its first column", async () => {
    /*
     * Needs Attention asks "due within two hours and not started". That used
     * to mean the first column *of kind open*, which stops being the first
     * column once a board opens with a stage classified some other way.
     */
    const board = boardFor(IDS.nike);
    const [first] = await db.execute(sql`
      select id, name from board_statuses
      where board_id = ${board} order by position asc limit 1
    `).then((r) => r.rows as unknown as { id: string; name: string }[]);

    expect(first!.name).toBe("To Do");
    await addStages();
    const [stillFirst] = await db.execute(sql`
      select id from board_statuses
      where board_id = ${board} order by position asc limit 1
    `).then((r) => r.rows as unknown as { id: string }[]);
    expect(stillFirst!.id).toBe(first!.id);
  });
});
