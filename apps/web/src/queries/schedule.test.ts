import { beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { taskSchedule, tasks, users, type Task, type User } from "@/db/schema";
import { canViewTask } from "@/lib/permissions";
import { atMinutes, minutesFromMidnight } from "@/lib/plan";
import { IDS, NOW, addTask, resetDb, seedOrg } from "../../test/fixture";
import { getDayPlan, plannedTaskIds } from "./schedule";

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
