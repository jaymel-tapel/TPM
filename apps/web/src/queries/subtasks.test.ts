import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { IDS, NOW, addTask, resetDb, seedOrg } from "../../test/fixture";
import { getDayView } from "./tasks";
import { getAccountToday } from "./accounts";
import { getDepartmentToday } from "./department";
import { getReportMetrics } from "./reports";
import { getNeedsAttention } from "./attention";
import { accountScope, userScope } from "./sql";

/**
 * A task with children is a container; its children are the units of work.
 *
 * The rule exists so that splitting a task changes what the day *looks like*
 * without changing how much there is to do. Without it, "3 of 5 done today"
 * moves when somebody reorganises rather than when they finish something —
 * a number you improve by rearranging, which is the gaming the brief warns
 * against.
 *
 * These tests are the rule. Everything else about subtasks is presentation.
 */
describe("splitting a task", () => {
  let parent: string;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    parent = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
  });

  it("does not change how much work the day holds", async () => {
    const before = await getDayView(IDS.anna, NOW);
    expect(before.due).toBe(1);

    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, parent });
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, parent });

    const after = await getDayView(IDS.anna, NOW);
    // Two children replace one parent, not add to it.
    expect(after.due).toBe(2);
    expect(after.today.map((t) => t.id)).not.toContain(parent);
  });

  it("keeps the account, the department and the report agreeing", async () => {
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, parent });

    const day = await getDayView(IDS.anna, NOW);
    const account = await getAccountToday(IDS.volvo, NOW);
    const dept = await getDepartmentToday(NOW);
    const report = await getReportMetrics(userScope(IDS.anna), 7, NOW);
    // One piece of work, however many places you look at it from.
    expect(day.due).toBe(1);
    expect(account!.due).toBe(1);
    expect(dept.due).toBe(1);
    expect(report.due).toBe(1);
  });

  it("counts the children's completion, not the parent's", async () => {
    const a = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, parent });
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, parent });

    // A container carrying a completion date would still count for nothing.
    await db.update(tasks).set({ completedAt: NOW }).where(eq(tasks.id, parent));
    expect((await getDayView(IDS.anna, NOW)).done).toBe(0);

    await db.update(tasks).set({ completedAt: NOW }).where(eq(tasks.id, a));
    const day = await getDayView(IDS.anna, NOW);
    expect(day.done).toBe(1);
    expect(day.percent).toBe(50);
  });

  it("takes the parent out of every list of work", async () => {
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, parent });

    const day = await getDayView(IDS.anna, NOW);
    const ids = [...day.today, ...day.overdue, ...day.completed, ...day.upcoming].map(
      (t) => t.id,
    );
    expect(ids).not.toContain(parent);
  });

  it("keeps a container out of Needs Attention", async () => {
    /*
     * An overdue parent is not overdue work — its children are, or nothing is.
     * Five is the threshold where the alert turns high, so this counts them
     * precisely rather than reading the sentence.
     */
    for (let i = 0; i < 5; i += 1) {
      await addTask({ account: IDS.volvo, assignees: [IDS.james], dueDay: -5 });
    }
    const before = await getNeedsAttention(accountScope(IDS.volvo), NOW);
    expect(before.some((i) => /James/.test(i.headline) && i.severity === "high")).toBe(true);

    // Break one of them down. It stops being overdue work in its own right,
    // and its child is due today rather than late — so James drops to four.
    const [late] = (
      await db.execute(
        sql`select id from tasks where account_id = ${IDS.volvo} order by due_date asc limit 1`,
      )
    ).rows as unknown as { id: string }[];
    await addTask({ account: IDS.volvo, assignees: [IDS.james], dueDay: 0, parent: late!.id });

    const after = await getNeedsAttention(accountScope(IDS.volvo), NOW);
    expect(after.some((i) => /James/.test(i.headline) && i.severity === "high")).toBe(false);
  });

  it("still opens the parent's own page", async () => {
    // Excluded from lists of work, not from existence.
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, parent });
    const { getTaskCard } = await import("./tasks");
    const card = await getTaskCard(parent);
    expect(card).not.toBeNull();
    expect(card!.childCount).toBe(1);
    expect(card!.childrenDone).toBe(0);
  });

  it("tells a child what it belongs to", async () => {
    const child = await addTask({
      account: IDS.volvo,
      assignees: [IDS.anna],
      dueDay: 0,
      parent,
    });
    const { getTaskCard } = await import("./tasks");
    const card = await getTaskCard(child);
    expect(card!.parentId).toBe(parent);
    expect(card!.parentTitle).toBeTruthy();
  });

  it("takes its children with it when it goes", async () => {
    const child = await addTask({
      account: IDS.volvo,
      assignees: [IDS.anna],
      dueDay: 0,
      parent,
    });
    await db.execute(sql`delete from tasks where id = ${parent}`);
    const [{ n }] = (
      await db.execute(sql`select count(*)::int as n from tasks where id = ${child}`)
    ).rows as unknown as { n: number }[];
    expect(n).toBe(0);
  });
});
