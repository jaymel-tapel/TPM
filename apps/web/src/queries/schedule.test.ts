import { beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { taskSchedule, tasks, users, type Task, type User } from "@/db/schema";
import { canViewTask } from "@/lib/permissions";
import { atMinutes, minutesFromMidnight, planDays } from "@/lib/plan";
import { IDS, NOW, addTask, resetDb, seedOrg } from "../../test/fixture";
import { getDayPlan, getPlanCounts, plannedTaskIds } from "./schedule";

const load = async (id: string): Promise<User> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new Error(`no such user ${id}`);
  return user;
};

const loadTask = async (id: string): Promise<Task> => {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) throw new Error(`no such task ${id}`);
  return task;
};

/** Places a block directly, the way the action would after snapping. */
const place = (taskId: string, userId: string, minutesFromStart: number, minutes = 30) =>
  db.insert(taskSchedule).values({
    taskId,
    userId,
    startsAt: atMinutes(NOW, minutesFromStart),
    minutes,
  });

describe("a day plan", () => {
  let shared: string;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    // One task, two people — the case the table is shaped for.
    shared = await addTask({
      team: IDS.teamA,
      assignees: [IDS.anna, IDS.james],
      dueDay: 0,
    });
  });

  it("is one person's, even when the task is shared", async () => {
    /*
     * The reason `task_schedule` is keyed by person rather than being a column
     * on `tasks`. Anna doing it at ten and James at three is not a conflict; it
     * is two people planning their own afternoons around one piece of work.
     */
    await place(shared, IDS.anna, 10 * 60);
    await place(shared, IDS.james, 15 * 60);

    const anna = await getDayPlan(IDS.anna, NOW);
    const james = await getDayPlan(IDS.james, NOW);

    expect(anna).toHaveLength(1);
    expect(james).toHaveLength(1);
    expect(minutesFromMidnight(anna[0]!.startsAt)).toBe(600);
    expect(minutesFromMidnight(james[0]!.startsAt)).toBe(900);
  });

  it("shows a teammate nothing of yours", async () => {
    await place(shared, IDS.anna, 10 * 60);
    expect(await getDayPlan(IDS.sarah, NOW)).toEqual([]);
  });

  it("holds a task once per person, so planning again moves it", async () => {
    await place(shared, IDS.anna, 10 * 60);
    await db
      .insert(taskSchedule)
      .values({ taskId: shared, userId: IDS.anna, startsAt: atMinutes(NOW, 840), minutes: 45 })
      .onConflictDoUpdate({
        target: [taskSchedule.taskId, taskSchedule.userId],
        set: { startsAt: atMinutes(NOW, 840), minutes: 45 },
      });

    const plan = await getDayPlan(IDS.anna, NOW);
    expect(plan).toHaveLength(1);
    expect(minutesFromMidnight(plan[0]!.startsAt)).toBe(840);
    expect(plan[0]!.minutes).toBe(45);
  });

  it("reads the start as a time, not the string Postgres printed", async () => {
    // `agoLabel` and the grid both do arithmetic on this. A string reaches the
    // page and fails there instead of here.
    await place(shared, IDS.anna, 10 * 60);
    const [block] = await getDayPlan(IDS.anna, NOW);
    expect(block!.startsAt).toBeInstanceOf(Date);
  });

  it("reads oldest first", async () => {
    const later = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 });
    await place(later, IDS.anna, 16 * 60);
    await place(shared, IDS.anna, 9 * 60);

    expect((await getDayPlan(IDS.anna, NOW)).map((b) => minutesFromMidnight(b.startsAt))).toEqual([
      540, 960,
    ]);
  });

  it("carries what the block needs to render itself", async () => {
    await place(shared, IDS.anna, 10 * 60, 90);
    const [block] = await getDayPlan(IDS.anna, NOW);
    expect(block).toMatchObject({ taskId: shared, minutes: 90, done: false });
    expect(block!.title).toBeTruthy();
  });

  it("leaves another day out of today", async () => {
    await place(shared, IDS.anna, 10 * 60);
    await db
      .update(taskSchedule)
      .set({ startsAt: new Date(atMinutes(NOW, 600).getTime() + 86_400_000) })
      .where(eq(taskSchedule.taskId, shared));

    expect(await getDayPlan(IDS.anna, NOW)).toEqual([]);
  });

  it("goes when the task goes", async () => {
    await place(shared, IDS.anna, 10 * 60);
    await db.execute(sql`delete from tasks where id = ${shared}`);
    expect(await getDayPlan(IDS.anna, NOW)).toEqual([]);
  });

  it("clears only the caller's own block", async () => {
    // What `unplanTask` does, with the owner in the WHERE clause. Anna dropping
    // a shared task out of her day must leave James's afternoon alone.
    await place(shared, IDS.anna, 10 * 60);
    await place(shared, IDS.james, 15 * 60);

    await db
      .delete(taskSchedule)
      .where(and(eq(taskSchedule.taskId, shared), eq(taskSchedule.userId, IDS.anna)));

    expect(await getDayPlan(IDS.anna, NOW)).toEqual([]);
    expect(await getDayPlan(IDS.james, NOW)).toHaveLength(1);
  });

  it("says which tasks are already placed, for the list to mark", async () => {
    const other = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 });
    await place(shared, IDS.anna, 10 * 60);

    const placed = await plannedTaskIds(IDS.anna, NOW);
    expect(placed.has(shared)).toBe(true);
    expect(placed.has(other)).toBe(false);
  });
});

describe("what may be planned", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("is exactly what the viewer may see", async () => {
    /*
     * `planTask` gates on `loadViewableTask`, so this is the boundary a forged
     * `taskId` runs into: a team A task is not plannable by team B, however the
     * id was obtained. Pinning it here means a change to `canViewTask` cannot
     * quietly widen who can file blocks against whose work.
     */
    const teamATask = await loadTask(
      await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 }),
    );

    expect(await canViewTask(await load(IDS.mika), teamATask)).toBe(false);
    expect(await canViewTask(await load(IDS.james), teamATask)).toBe(true);
    // A director plans time to review work that is not theirs to edit.
    expect(await canViewTask(await load(IDS.elena), teamATask)).toBe(true);
  });
});

describe("planning further out", () => {
  let a: string;
  let b: string;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    a = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 });
    b = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 });
  });

  const on = (day: Date, taskId: string, minutesFromStart: number) =>
    db.insert(taskSchedule).values({
      taskId,
      userId: IDS.anna,
      startsAt: new Date(day.getTime() + minutesFromStart * 60_000),
      minutes: 30,
    });

  it("keeps each day to itself", async () => {
    const [today, tomorrow] = planDays(NOW);
    await on(today!, a, 10 * 60);
    await on(tomorrow!, b, 14 * 60);

    expect((await getDayPlan(IDS.anna, today!)).map((x) => x.taskId)).toEqual([a]);
    expect((await getDayPlan(IDS.anna, tomorrow!)).map((x) => x.taskId)).toEqual([b]);
  });

  it("marks a task planned only on the day it is planned for", async () => {
    // The row's Plan command reads this. Marking it done on every day would
    // say a task was handled when it is still loose on the day you are looking
    // at.
    const [today, tomorrow] = planDays(NOW);
    await on(tomorrow!, a, 14 * 60);

    expect((await plannedTaskIds(IDS.anna, today!)).has(a)).toBe(false);
    expect((await plannedTaskIds(IDS.anna, tomorrow!)).has(a)).toBe(true);
  });

  it("counts the week in one query, keyed by day", async () => {
    const days = planDays(NOW);
    await on(days[0]!, a, 9 * 60);
    await on(days[2]!, b, 9 * 60);

    const counts = await getPlanCounts(IDS.anna, days);
    // Every offered day gets a number, so a chip never renders undefined.
    expect(Object.keys(counts)).toHaveLength(days.length);
    expect(Object.values(counts).reduce((n, x) => n + x, 0)).toBe(2);
    expect(Object.values(counts).filter((n) => n === 1)).toHaveLength(2);
  });

  it("counts nobody else's week", async () => {
    const days = planDays(NOW);
    await on(days[0]!, a, 9 * 60);
    expect(Object.values(await getPlanCounts(IDS.james, days))).toEqual(
      days.map(() => 0),
    );
  });
});
